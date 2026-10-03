import { db } from '../shared/db/client';
import { env } from '../config/env';
import { syncOrderStatusFromShipment } from '../modules/orders/service';
import { mapDelhiveryStatus, handleEkartStatusUpdate } from '../modules/webhooks/service';
import { fetchEkartTrack } from '../shared/integrations/ekart/client';

// Polls Delhivery for open shipments and updates tracking status. Hit by
// Cloud Scheduler every 2 hours — Delhivery's own webhook (webhooks/delhivery)
// is the primary path, this is the fallback in case a push is missed.
export async function syncOpenShipments(): Promise<{ synced: number }> {
  const ekartSynced = await syncEkartShipments();
  if (!env.DELHIVERY_API_KEY) return { synced: ekartSynced };

  const open = await db.shipment.findMany({
    where: { status: { in: ['BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] }, delhiveryWaybill: { not: null }, carrier: 'DELHIVERY' },
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
      const mappedStatus = mapDelhiveryStatus(status);
      await db.shipment.update({ where: { id: shipment.id }, data: { status: mappedStatus } });
      await syncOrderStatusFromShipment(shipment.orderId, mappedStatus);
      synced++;
    }
  }

  return { synced: synced + ekartSynced };
}

// Ekart fallback for a missed track_updated push. Uses Ekart's open tracking endpoint
// (no credentials needed) and feeds the same handler the webhook uses.
async function syncEkartShipments(): Promise<number> {
  const open = await db.shipment.findMany({
    where: { status: { in: ['BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'FAILED'] }, delhiveryWaybill: { not: null }, carrier: 'EKART' },
  });
  let synced = 0;
  for (const shipment of open) {
    try {
      const track = await fetchEkartTrack(shipment.delhiveryWaybill!);
      if (!track) continue;
      await handleEkartStatusUpdate(shipment.delhiveryWaybill!, {
        status: track.status,
        location: track.location,
        description: track.desc,
        timestamp: new Date(track.ctime).toISOString(),
        ndrStatus: track.ndrStatus,
      });
      synced++;
    } catch {
      // One bad parcel must not stop the rest of the sweep.
    }
  }
  return synced;
}
