import { db } from '../shared/db/client';
import { invalidateProductCaches } from '../modules/products/service';
import { cancelPendingOrderTx } from '../modules/orders/service';

// Sweeps orders stuck in PENDING_PAYMENT past their reservation window and
// releases the reserved stock back to inventory. Hit by Cloud Scheduler.
export async function releaseExpiredHolds(): Promise<{ released: number }> {
  const expired = await db.order.findMany({
    where: { status: 'PENDING_PAYMENT', reservedUntil: { lt: new Date() } },
    include: { items: true },
  });

  for (const order of expired) {
    await db.$transaction((tx) => cancelPendingOrderTx(tx, order, 'Reservation expired', 'system'));
  }

  if (expired.length > 0) await invalidateProductCaches();
  return { released: expired.length };
}
