// One-off: Shipment.status was already correct (webhooks/tracking-sync kept it in
// sync) but Order.status never followed until syncOrderStatusFromShipment existed.
// Re-runs that sync for every existing shipment against its already-stored status —
// no Delhivery API call needed, this is pure DB reconciliation.
import { db } from '../src/shared/db/client';
import { syncOrderStatusFromShipment } from '../src/modules/orders/service';

async function main() {
  const shipments = await db.shipment.findMany({ select: { orderId: true, status: true } });

  let updated = 0;
  for (const s of shipments) {
    const before = await db.order.findUnique({ where: { id: s.orderId }, select: { status: true, orderNumber: true } });
    await syncOrderStatusFromShipment(s.orderId, s.status);
    const after = await db.order.findUnique({ where: { id: s.orderId }, select: { status: true } });
    if (before && after && before.status !== after.status) {
      updated++;
      console.log(`${before.orderNumber}: ${before.status} -> ${after.status}`);
    }
  }

  console.log(`\nBackfill done. ${updated}/${shipments.length} orders updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
