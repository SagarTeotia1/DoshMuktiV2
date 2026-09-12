import { format } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "../../shared/db/client";
import { createOrderSession } from "../../shared/integrations/hdfc-smartgateway/client";
import { handlePaymentFailed } from "../webhooks/service";
import { redis } from "../../shared/cache/client";
import { cacheKeys, CACHE_TTL } from "../../shared/cache/keys";
import { env } from "../../config/env";
import { calculateShippingCost } from "../../shared/integrations/delhivery/client";
import {
  SHIPPING_FEE,
  FREE_SHIPPING_ABOVE,
  RESERVATION_MINUTES,
  PACKAGING_WEIGHT_GRAMS,
} from "../../shared/constants/purposes";
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

// The order+reservation already committed before this can be thrown (see
// initiateCheckout) — handlePaymentFailed has already released the stock/coupon hold and
// cancelled the order by the time the controller sees this, so there's nothing stuck.
export class PaymentGatewayError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "Payment gateway request failed");
    this.name = "PaymentGatewayError";
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

// Live Delhivery rate (Surface mode), cached by route+weight since the same
// origin/destination/weight always prices the same — this is hit on every cart/PDP
// view, not just checkout, so an uncached call there would hammer Delhivery for no
// reason. Returns null (never throws) on any failure so callers can fall back to the
// flat SHIPPING_FEE — a customer must never be blocked from checking out because a
// pricing API had a bad moment.
async function getLiveShippingRate(destPincode: string, weightGrams: number): Promise<number | null> {
  const originPincode = env.DELHIVERY_WAREHOUSE_PINCODE;
  const key = cacheKeys.shippingRate(originPincode, destPincode, weightGrams);

  const cached = await redis.get<number>(key);
  if (typeof cached === "number") return cached;

  const result = await calculateShippingCost({ originPincode, destPincode, weightGrams, paymentMode: "Pre-paid" });
  if (!result) return null;

  const rounded = Math.ceil(result.amount);
  await redis.set(key, rounded, { ex: CACHE_TTL.SHIPPING_RATE });
  return rounded;
}

// Exported for the cart module — the cart's pricing preview (shown pre-checkout on the
// cart/checkout pages) must compute shipping the exact same way the real order will, or
// the displayed total drifts from what actually gets charged.
//
// `originalFee` is always the real (or flat-fallback) shipping cost regardless of the
// free-shipping threshold — the UI shows it struck through ("₹99 → FREE") once the cart
// crosses FREE_SHIPPING_ABOVE, rather than just disappearing. `fee` is what's actually
// charged (0 once waived).
export async function calculateShippingFee(
  subtotal: number,
  weightGrams: number,
  destPincode: string
): Promise<{ fee: number; originalFee: number }> {
  const liveRate = await getLiveShippingRate(destPincode, weightGrams);
  const originalFee = liveRate ?? SHIPPING_FEE;
  const fee = subtotal >= FREE_SHIPPING_ABOVE ? 0 : originalFee;
  return { fee, originalFee };
}

export async function initiateCheckout(input: CheckoutInput, userId: string) {
  // Name is no longer collected at login — this is the first place it's ever known for a
  // new customer, so backfill it onto their account the first time they check out.
  // `where: { name: null }` makes this a no-op for every later order, no read needed.
  await db.user.updateMany({ where: { id: userId, name: null }, data: { name: input.customerName } });

  const cached = await redis.get<string>(
    cacheKeys.pincode(input.shippingAddress.pincode),
  );
  if (cached === "false")
    throw new NotServiceableError(input.shippingAddress.pincode);

  const variantIds = input.items.map((i) => i.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: {
      product: { select: { name: true, basePrice: true, categories: true, gstRate: true } },
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
      categories: v.product.categories,
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
  // pattern behind this. Eligibility is resolved scope-aware (ALL_PRODUCTS/CATEGORY/SPECIFIC_PRODUCTS) via
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

  // Every physically-shipped item counts toward weight — paid items (from `variants`,
  // already fetched above) and free-gift items alike.
  const paidWeight = input.items.reduce((sum, item) => {
    const v = variants.find((x) => x.id === item.variantId)!;
    return sum + v.weight * item.quantity;
  }, 0);
  const freeWeight = freeItems.reduce((sum, item) => {
    const v = freeVariantById.get(item.variantId);
    return sum + (v?.weight ?? 0) * item.quantity;
  }, 0);
  const { fee: shippingFee } = await calculateShippingFee(
    subtotal,
    paidWeight + freeWeight + PACKAGING_WEIGHT_GRAMS,
    input.shippingAddress.pincode
  );
  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

  const { order } = await withSerializableRetry(() =>
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

        const order = await tx.order.create({
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

        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            // Our own orderNumber doubles as SmartGateway's order_id (see the
            // OrderSession.create call below) — known up front, no post-call update needed.
            hdfcOrderId: orderNumber,
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
        // payment create) against Neon's serverless Postgres, where a
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

  // SmartGateway call OUTSIDE the transaction — never hold a DB connection open across a network call
  const [firstName, ...lastNameParts] = input.customerName.trim().split(/\s+/);
  let session;
  try {
    session = await createOrderSession({
      orderId: order.orderNumber,
      amount: finalTotal,
      returnUrl: `${env.BACKEND_PUBLIC_URL}/api/checkout/return`,
      customerId: userId,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      firstName,
      lastName: lastNameParts.join(" ") || undefined,
    });
  } catch (err) {
    // Order + Payment(PENDING) already committed above (hdfcOrderId = order.orderNumber),
    // so a session-create failure would otherwise strand this order at PENDING_PAYMENT
    // with no payment link and no way for the customer to retry until the release-holds
    // cron eventually notices — same idempotent release path a failed/declined payment
    // already goes through, just triggered immediately instead of minutes later.
    await handlePaymentFailed(order.orderNumber, "SmartGateway order session creation failed");
    throw new PaymentGatewayError(err);
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentLink: session.paymentLink,
    amount: finalTotal,
    currency: "INR",
  };
}
