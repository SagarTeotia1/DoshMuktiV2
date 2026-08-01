import { db } from '../shared/db/client';
import { env } from '../config/env';

// Polls Delhivery for open shipments and updates tracking status. Hit by
// Cloud Scheduler every 30 min — Delhivery's own webhook (webhooks/delhivery)
// is the primary path, this is the fallback in case a push is missed.
export async function syncOpenShipments(): Promise<{ synced: number }> {
  if (!env.DELHIVERY_API_KEY) return { synced: 0 };

  const open = await db.shipment.findMany({
    where: { status: { in: ['BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] }, delhiveryWaybill: { not: null } },
  });

  let synced = 0;
  for (const shipment of open) {
    const res = await fetch(`${env.DELHIVERY_BASE_URL}/api/v1/packages/json/?waybill=${shipment.delhiveryWaybill}`, {
      headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}` },
    });
    if (!res.ok) continue;

    const data = (await res.json()) as { ShipmentData?: Array<{ Shipment: { Status: { Status: string } } }> };
    const status = data.ShipmentData?.[0]?.Shipment?.Status?.Status;
    if (status) {
      await db.shipment.update({ where: { id: shipment.id }, data: { status: status as never } });
      synced++;
    }
  }

  return { synced };
}
