import type { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { hashPhone } from '../../shared/utils/phone';

type TxOrClient = Prisma.TransactionClient | typeof db;

async function latestBalance(client: TxOrClient, phoneHash: string): Promise<number> {
  const last = await client.walletTransaction.findFirst({
    where: { phoneHash },
    orderBy: { createdAt: 'desc' },
  });
  return last ? Number(last.balance) : 0;
}

export async function getBalance(phone: string): Promise<number> {
  return latestBalance(db, hashPhone(phone));
}

export class InsufficientWalletBalanceError extends Error {
  constructor() {
    super('Insufficient wallet balance');
    this.name = 'InsufficientWalletBalanceError';
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
  orderId: string
): Promise<number> {
  if (requestedAmount <= 0) return 0;
  const phoneHash = hashPhone(phone);
  const balance = await latestBalance(tx, phoneHash);
  const redeemed = Math.min(requestedAmount, balance, maxRedeemable);
  if (redeemed <= 0) return 0;

  await tx.walletTransaction.create({
    data: { phoneHash, orderId, change: -redeemed, balance: balance - redeemed, reason: 'REDEEMED' },
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
    include: { items: { include: { variant: { include: { product: { include: { offers: true } } } } } } },
  });
  if (!order) return;

  const cashback = order.items.reduce((sum, item) => {
    const productPct = item.variant.product.cashbackPercent ?? 0;
    const offerPct = item.variant.product.offers
      .filter((o) => o.isActive && o.type === 'CASHBACK')
      .reduce((s, o) => s + (o.cashbackPercent ?? 0), 0);
    const pct = productPct + offerPct;
    if (!pct) return sum;
    return sum + (Number(item.priceAtPurchase) * item.quantity * pct) / 100;
  }, 0);
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
        reason: 'CASHBACK_EARNED',
      },
    });
  });
}

export async function adminAdjustBalance(phone: string, amount: number, note: string): Promise<number> {
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
        reason: amount > 0 ? 'MANUAL_GRANT' : 'MANUAL_DEDUCT',
        note,
      },
    });
    return newBalance;
  });
}
