import { db } from '../shared/db/client';
import { invalidateProductCaches } from '../modules/products/service';
import { releaseCouponUsageTx } from '../modules/coupons/service';

// Sweeps orders stuck in PENDING_PAYMENT past their reservation window and
// releases the reserved stock back to inventory. Hit by Cloud Scheduler.
export async function releaseExpiredHolds(): Promise<{ released: number }> {
  const expired = await db.order.findMany({
    where: { status: 'PENDING_PAYMENT', reservedUntil: { lt: new Date() } },
    include: { items: true },
  });

  for (const order of expired) {
    await db.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${item.quantity} WHERE id = ${item.variantId}
        `;
        await tx.stockMovement.create({
          data: { variantId: item.variantId, change: item.quantity, reason: 'RESERVATION_RELEASED', orderId: order.id, createdBy: 'system' },
        });
      }
      // Mirrors the stock release above — an abandoned checkout shouldn't permanently
      // burn a limited-use coupon slot. Same atomicity guarantee (same transaction).
      if (order.couponId) {
        await releaseCouponUsageTx(tx, order.couponId);
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', statusLog: { create: { from: 'PENDING_PAYMENT', to: 'CANCELLED', createdBy: 'system', note: 'Reservation expired' } } },
      });
    });
  }

  if (expired.length > 0) await invalidateProductCaches();
  return { released: expired.length };
}
