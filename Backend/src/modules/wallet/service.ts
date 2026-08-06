import type { Prisma } from "@prisma/client";
import { db } from "../../shared/db/client";
import { hashPhone } from "../../shared/utils/phone";
import { processReward } from "../offers/rewards/registry";
import { getApplicableOffersForProduct } from "../offers/service";

type TxOrClient = Prisma.TransactionClient | typeof db;

async function latestBalance(
  client: TxOrClient,
  phoneHash: string,
): Promise<number> {
  const last = await client.walletTransaction.findFirst({
    where: { phoneHash },
    orderBy: { createdAt: "desc" },
  });
  return last ? Number(last.balance) : 0;
}

export async function getBalance(phone: string): Promise<number> {
  return latestBalance(db, hashPhone(phone));
}

export class InsufficientWalletBalanceError extends Error {
  constructor() {
    super("Insufficient wallet balance");
    this.name = "InsufficientWalletBalanceError";
  }
}

/**
 * Called from inside the checkout Serializable transaction, after the Order row
 * exists (needs order.id for the ledger entry) — never call standalone. Clamps to
 * the smaller of what was requested, the live balance, and `maxRedeemable` (the
 * order total) rather than throwing — a few seconds of drift between the balance
 * the customer saw and checkout submitting is expected, not an error.
 */
export async function redeemInCheckoutTx(
  tx: Prisma.TransactionClient,
  phone: string,
  requestedAmount: number,
  maxRedeemable: number,
  orderId: string,
): Promise<number> {
  if (requestedAmount <= 0) return 0;
  const phoneHash = hashPhone(phone);
  const balance = await latestBalance(tx, phoneHash);
  const redeemed = Math.min(requestedAmount, balance, maxRedeemable);
  if (redeemed <= 0) return 0;

  await tx.walletTransaction.create({
    data: {
      phoneHash,
      orderId,
      change: -redeemed,
      balance: balance - redeemed,
      reason: "REDEEMED",
    },
  });
  return redeemed;
}

/** Called from the payment-captured webhook — credits cashback for items whose
 * product has cashbackPercent set, plus any active CASHBACK-type Offer linked to
 * that product (the two sum together, they're independent mechanisms).
 * Not part of the checkout transaction. */
export async function creditCashbackForOrder(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: {
                select: { id: true, category: true, cashbackPercent: true },
              },
            },
          },
        },
      },
    },
  });
  if (!order) return;

  let cashback = 0;
  for (const item of order.items) {
    const itemSubtotal = Number(item.priceAtPurchase) * item.quantity;
    const product = item.variant.product;

    // Product.cashbackPercent — independent of Offer, unchanged math.
    const productPct = product.cashbackPercent ?? 0;
    if (productPct) cashback += (itemSubtotal * productPct) / 100;

    // Any active CASHBACK-reward Offer applicable to this product — scope-aware
    // (ALL_PRODUCTS/CATEGORY/SPECIFIC_PRODUCTS) via the shared resolution helper, not
    // just the old products-relation-only include. The two sum together, they're
    // independent mechanisms. Routed through the same strategy-pattern processReward()
    // checkout uses, so the math lives in exactly one place (offers/rewards/cashback.ts).
    const applicableOffers = await getApplicableOffersForProduct({
      id: product.id,
      category: product.category,
    });
    const cashbackOffers = applicableOffers.filter(
      (o) => o.reward === "CASHBACK",
    );
    for (const offer of cashbackOffers) {
      // Same minOrderValue gate resolveAutoAppliedRewardsForCheckout applies to
      // discount/free-gift offers — checked against the order's own persisted subtotal
      // (pre-discount cart value, same base Coupon.minOrder uses elsewhere) since this
      // runs post-payment, outside the checkout flow where a live cart subtotal exists.
      // Without this, an admin-configured "cashback above ₹X" offer paid out on every
      // order regardless of size — the Admin form's own helper text promises otherwise.
      if (
        offer.minOrderValue != null &&
        Number(order.subtotal) < Number(offer.minOrderValue)
      )
        continue;
      const result = await processReward(offer, {
        productId: product.id,
        itemSubtotal,
      });
      cashback += result.cashbackAmount ?? 0;
    }
  }
  if (cashback <= 0) return;

  const phoneHash = hashPhone(order.customerPhone);
  await db.$transaction(async (tx) => {
    const balance = await latestBalance(tx, phoneHash);
    await tx.walletTransaction.create({
      data: {
        phoneHash,
        orderId,
        change: cashback,
        balance: balance + cashback,
        reason: "CASHBACK_EARNED",
      },
    });
  });
}

export async function adminAdjustBalance(
  phone: string,
  amount: number,
  note: string,
): Promise<number> {
  const phoneHash = hashPhone(phone);
  return db.$transaction(async (tx) => {
    const balance = await latestBalance(tx, phoneHash);
    const newBalance = balance + amount;
    if (newBalance < 0) throw new InsufficientWalletBalanceError();
    await tx.walletTransaction.create({
      data: {
        phoneHash,
        change: amount,
        balance: newBalance,
        reason: amount > 0 ? "MANUAL_GRANT" : "MANUAL_DEDUCT",
        note,
      },
    });
    return newBalance;
  });
}
