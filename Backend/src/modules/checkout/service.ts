import { format } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "../../shared/db/client";
import { razorpay } from "../../shared/integrations/razorpay/client";
import { redis } from "../../shared/cache/client";
import { cacheKeys } from "../../shared/cache/keys";
import {
  SHIPPING_FEE,
  FREE_SHIPPING_ABOVE,
  RESERVATION_MINUTES,
} from "../../shared/constants/purposes";
import { redeemInCheckoutTx } from "../wallet/service";
import { resolveAutoAppliedRewardsForCheckout } from "../offers/service";
import {
  findValidatedCoupon,
  resolveCouponRewardsForCheckout,
  reserveCouponUsageTx,
  CouponExhaustedError,
} from "../coupons/service";
import type { CheckoutInput } from "./schema";

export class OutOfStockError extends Error {
  constructor(public variantId: string) {
    super(`Out of stock: ${variantId}`);
    this.name = "OutOfStockError";
  }
}

export class NotServiceableError extends Error {
  constructor(public pincode: string) {
    super(`Pincode not serviceable: ${pincode}`);
    this.name = "NotServiceableError";
  }
}

// Postgres raises this (Prisma surfaces it as error code P2034) when a Serializable
// transaction's write conflicts with another concurrent transaction on the same row(s) —
// e.g. two checkouts racing for the last slot of a maxUses:1 coupon, or the last unit of
// stock. This is expected, documented behavior under SERIALIZABLE, not a bug: Postgres's
// own docs say applications at this isolation level "must be prepared to retry
// transactions due to serialization failures." Without a retry, the losing request's
// P2034 propagates as a raw, unmapped error (a 500), even though re-running the exact
// same transaction from scratch would resolve cleanly against the now-current state
// (e.g. correctly surface CouponExhaustedError/OutOfStockError instead of crashing).
function isSerializationConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2034"
  );
}

async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isSerializationConflict(err) || attempt === maxAttempts) throw err;
    }
  }
  // Unreachable — the loop always returns or throws — but keeps TypeScript's control-flow
  // analysis happy without an unsafe non-null assertion at the call site.
  throw new Error(
    "withSerializableRetry: exhausted attempts without returning or throwing",
  );
}

// Rule: atomic UPDATE ... WHERE stockQuantity >= qty, sorted lock order —
// never findFirst-then-update. See docs/PATTERNS.md.
async function reserveStock(
  tx: Prisma.TransactionClient,
  items: Array<{ variantId: string; quantity: number }>,
): Promise<{ success: boolean; failedVariantId?: string }> {
  const sorted = [...items].sort((a, b) =>
    a.variantId.localeCompare(b.variantId),
  );
  for (const item of sorted) {
    const updated: number = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockQuantity" = "stockQuantity" - ${item.quantity}
      WHERE id = ${item.variantId} AND "stockQuantity" >= ${item.quantity} AND "isActive" = true
    `;
    if (updated === 0)
      return { success: false, failedVariantId: item.variantId };
  }
  return { success: true };
}

async function generateOrderNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const today = format(new Date(), "yyyyMMdd");
  const row = await tx.orderSequence.upsert({
    where: { date: today },
    update: { seq: { increment: 1 } },
    create: { date: today, seq: 1 },
  });
  return `DOSH-${today}-${String(row.seq).padStart(4, "0")}`;
}

// Exported for the cart module — the cart's pricing preview (shown pre-checkout on the
// cart/checkout pages) must compute shipping the exact same way the real order will, or
// the displayed total drifts from what actually gets charged.
export function calculateShippingFee(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
}

export async function initiateCheckout(input: CheckoutInput, userId: string) {
  const cached = await redis.get<string>(
    cacheKeys.pincode(input.shippingAddress.pincode),
  );
  if (cached === "false")
    throw new NotServiceableError(input.shippingAddress.pincode);

  const variantIds = input.items.map((i) => i.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: {
      product: { select: { name: true, basePrice: true, category: true, gstRate: true } },
    },
  });
  if (variants.length !== input.items.length) {
    const missing = variantIds.find(
      (id) => !variants.find((v) => v.id === id),
    )!;
    throw new OutOfStockError(missing);
  }

  const checkoutLineItems = input.items.map((item) => {
    const v = variants.find((x) => x.id === item.variantId)!;
    return {
      variantId: item.variantId,
      productId: v.productId,
      category: v.product.category,
      quantity: item.quantity,
      itemSubtotal:
        Number(v.priceOverride ?? v.product.basePrice) * item.quantity,
    };
  });

  const subtotal = checkoutLineItems.reduce(
    (sum, item) => sum + item.itemSubtotal,
    0,
  );

  // Discount + free-gift resolution — automatic, no coupon code. Preserves prior semantics:
  // first-matching-discount-offer-per-item (no stacking), one free unit per matching
  // FREE_GIFT offer per order. See offers/service.ts + offers/rewards/ for the strategy
  // pattern behind this — CASHBACK is excluded, it stays wallet-only, resolved post-payment.
  // Eligibility is resolved scope-aware (ALL_PRODUCTS/CATEGORY/SPECIFIC_PRODUCTS) via
  // attachApplicableOffers inside resolveAutoAppliedRewardsForCheckout.
  const autoRewards =
    await resolveAutoAppliedRewardsForCheckout(checkoutLineItems);
  let totalDiscount = autoRewards.totalDiscount;
  let freeItems = autoRewards.freeItems;

  // Coupon resolution — read-only validation happens here, before the transaction (the
  // real, race-safe usage-limit guard is reserveCouponUsageTx, run inside the transaction
  // below). findValidatedCoupon throws straight through to the controller on any failure.
  const coupon = input.couponCode
    ? await findValidatedCoupon({
        code: input.couponCode,
        subtotal,
        customerDob: input.customerDob,
      })
    : null;
  if (coupon) {
    const couponRewards = await resolveCouponRewardsForCheckout(
      checkoutLineItems,
      coupon.id,
    );
    totalDiscount += couponRewards.discountAmount;
    freeItems = [...freeItems, ...couponRewards.freeItems];
  }

  // Free items (auto-applied + coupon-granted) are reserved through the exact same
  // atomic stock path as paid items (out of stock blocks checkout, same as any item) —
  // need their sku/attributes for the OrderItem snapshot.
  const freeVariantById = new Map<
    string,
    Prisma.ProductVariantGetPayload<object>
  >();
  if (freeItems.length > 0) {
    const freeVariants = await db.productVariant.findMany({
      where: { id: { in: freeItems.map((f) => f.variantId) } },
    });
    for (const v of freeVariants) freeVariantById.set(v.id, v);
  }

  const allReservationItems = [...input.items, ...freeItems];

  const shippingFee = calculateShippingFee(subtotal);
  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

  const { order, payment } = await withSerializableRetry(() =>
    db.$transaction(
      async (tx) => {
        const reservation = await reserveStock(tx, allReservationItems);
        if (!reservation.success)
          throw new OutOfStockError(reservation.failedVariantId!);

        // Inside the transaction, immediately after stock reservation succeeds — this is
        // the real usage-limit guard (findValidatedCoupon's pre-transaction check can race
        // under concurrent checkouts for the last slot). A false here rolls the whole
        // transaction back, releasing the stock reservation from this same request too —
        // no separate compensation logic needed, Serializable rollback handles both.
        if (coupon) {
          const reserved = await reserveCouponUsageTx(tx, coupon.id);
          if (!reserved) throw new CouponExhaustedError(coupon.id);
        }

        const orderNumber = await generateOrderNumber(tx);
        const orderTotal = subtotal + shippingFee - totalDiscount;

        let order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            customerEmail: input.customerEmail,
            customerDob: input.customerDob ?? null,
            shippingAddress: input.shippingAddress,
            subtotal,
            shippingFee,
            discountAmount: totalDiscount,
            total: orderTotal,
            couponId: coupon?.id ?? null,
            reservedUntil,
            items: {
              create: [
                ...input.items.map((item) => {
                  const v = variants.find((v) => v.id === item.variantId)!;
                  return {
                    variantId: item.variantId,
                    quantity: item.quantity,
                    priceAtPurchase: v.priceOverride ?? v.product.basePrice,
                    variantSnapshot: {
                      sku: v.sku,
                      attributes: v.attributes,
                      productName: v.product.name,
                      gstRate: v.product.gstRate !== null ? Number(v.product.gstRate) : null,
                    },
                  };
                }),
                ...freeItems.map((item) => {
                  const fv = freeVariantById.get(item.variantId)!;
                  return {
                    variantId: item.variantId,
                    quantity: item.quantity,
                    priceAtPurchase: 0,
                    variantSnapshot: {
                      sku: fv.sku,
                      attributes: fv.attributes,
                      isFreeGift: true,
                      gstRate: null,
                    },
                  };
                }),
              ],
            },
          },
        });

        const redeemed = await redeemInCheckoutTx(
          tx,
          input.customerPhone,
          input.walletRedeem,
          orderTotal,
          order.id,
        );
        if (redeemed > 0) {
          order = await tx.order.update({
            where: { id: order.id },
            data: { walletRedeemed: redeemed, total: orderTotal - redeemed },
          });
        }

        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            razorpayOrderId: `pending_${order.id}`,
            amount: order.total,
            status: "PENDING",
          },
        });

        return { order, payment };
      },
      {
        isolationLevel: "Serializable",
        // Prisma's defaults (maxWait 2s, timeout 5s) are too tight for this transaction's
        // full round-trip count (stock reserve + coupon reservation + order/items create +
        // wallet redeem + payment create) against Neon's serverless Postgres, where a
        // cold-started compute alone can eat several seconds on the first query. Hitting
        // the default timeout closes the transaction mid-flight — any later query against
        // it (e.g. payment.create) then fails with P2028 "Transaction not found", even
        // though nothing was actually wrong with the transaction's logic.
        maxWait: 5000,
        timeout: 15000,
      },
    ),
  );

  const finalTotal = Number(order.total);

  // Razorpay call OUTSIDE the transaction — never hold a DB connection open across a network call
  const rzpOrder = await razorpay.orders.create({
    amount: Math.round(finalTotal * 100),
    currency: "INR",
    receipt: order.orderNumber,
  });

  await db.payment.update({
    where: { id: payment.id },
    data: { razorpayOrderId: rzpOrder.id },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    rzpOrderId: rzpOrder.id,
    amount: Math.round(finalTotal * 100),
    currency: "INR",
  };
}
