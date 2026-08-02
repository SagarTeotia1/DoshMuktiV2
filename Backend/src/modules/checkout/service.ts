import { format } from 'date-fns';
import type { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { razorpay } from '../../shared/integrations/razorpay/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys } from '../../shared/cache/keys';
import { SHIPPING_FEE, FREE_SHIPPING_ABOVE, RESERVATION_MINUTES } from '../../shared/constants/purposes';
import { redeemInCheckoutTx } from '../wallet/service';
import type { CheckoutInput } from './schema';

export class OutOfStockError extends Error {
  constructor(public variantId: string) {
    super(`Out of stock: ${variantId}`);
    this.name = 'OutOfStockError';
  }
}

export class NotServiceableError extends Error {
  constructor(public pincode: string) {
    super(`Pincode not serviceable: ${pincode}`);
    this.name = 'NotServiceableError';
  }
}

// Rule: atomic UPDATE ... WHERE stockQuantity >= qty, sorted lock order —
// never findFirst-then-update. See docs/PATTERNS.md.
async function reserveStock(
  tx: Prisma.TransactionClient,
  items: Array<{ variantId: string; quantity: number }>
): Promise<{ success: boolean; failedVariantId?: string }> {
  const sorted = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
  for (const item of sorted) {
    const updated: number = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockQuantity" = "stockQuantity" - ${item.quantity}
      WHERE id = ${item.variantId} AND "stockQuantity" >= ${item.quantity} AND "isActive" = true
    `;
    if (updated === 0) return { success: false, failedVariantId: item.variantId };
  }
  return { success: true };
}

async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const today = format(new Date(), 'yyyyMMdd');
  const row = await tx.orderSequence.upsert({
    where: { date: today },
    update: { seq: { increment: 1 } },
    create: { date: today, seq: 1 },
  });
  return `DOSH-${today}-${String(row.seq).padStart(4, '0')}`;
}

function calculateShippingFee(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
}

export async function initiateCheckout(input: CheckoutInput) {
  const cached = await redis.get<string>(cacheKeys.pincode(input.shippingAddress.pincode));
  if (cached === 'false') throw new NotServiceableError(input.shippingAddress.pincode);

  const variantIds = input.items.map((i) => i.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: { product: { select: { name: true, basePrice: true } } },
  });
  if (variants.length !== input.items.length) {
    const missing = variantIds.find((id) => !variants.find((v) => v.id === id))!;
    throw new OutOfStockError(missing);
  }

  const subtotal = input.items.reduce((sum, item) => {
    const v = variants.find((v) => v.id === item.variantId)!;
    return sum + Number(v.priceOverride ?? v.product.basePrice) * item.quantity;
  }, 0);
  const shippingFee = calculateShippingFee(subtotal);
  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

  const { order, payment } = await db.$transaction(
    async (tx) => {
      const reservation = await reserveStock(tx, input.items);
      if (!reservation.success) throw new OutOfStockError(reservation.failedVariantId!);

      const orderNumber = await generateOrderNumber(tx);

      let order = await tx.order.create({
        data: {
          orderNumber,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerEmail: input.customerEmail,
          shippingAddress: input.shippingAddress,
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          reservedUntil,
          items: {
            create: input.items.map((item) => {
              const v = variants.find((v) => v.id === item.variantId)!;
              return {
                variantId: item.variantId,
                quantity: item.quantity,
                priceAtPurchase: v.priceOverride ?? v.product.basePrice,
                variantSnapshot: { sku: v.sku, attributes: v.attributes, productName: v.product.name },
              };
            }),
          },
        },
      });

      const redeemed = await redeemInCheckoutTx(tx, input.customerPhone, input.walletRedeem, subtotal + shippingFee, order.id);
      if (redeemed > 0) {
        order = await tx.order.update({
          where: { id: order.id },
          data: { walletRedeemed: redeemed, total: subtotal + shippingFee - redeemed },
        });
      }

      const payment = await tx.payment.create({
        data: { orderId: order.id, razorpayOrderId: `pending_${order.id}`, amount: order.total, status: 'PENDING' },
      });

      return { order, payment };
    },
    { isolationLevel: 'Serializable' }
  );

  const finalTotal = Number(order.total);

  // Razorpay call OUTSIDE the transaction — never hold a DB connection open across a network call
  const rzpOrder = await razorpay.orders.create({
    amount: Math.round(finalTotal * 100),
    currency: 'INR',
    receipt: order.orderNumber,
  });

  await db.payment.update({ where: { id: payment.id }, data: { razorpayOrderId: rzpOrder.id } });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    rzpOrderId: rzpOrder.id,
    amount: Math.round(finalTotal * 100),
    currency: 'INR',
  };
}
