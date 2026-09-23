// One-off: shipments created since a given date never got their real Delhivery status
// synced (webhook/cron gap) — DB shows them all stuck at BOOKED. Fetches each waybill's
// live status from Delhivery directly and applies it through the same path the webhook
// and tracking-sync cron use, so Order.status and OrderStatusLog stay correct/traceable.
import { db } from '../src/shared/db/client';
import { env } from '../src/config/env';
import { mapDelhiveryStatus } from '../src/modules/webhooks/service';
import { syncOrderStatusFromShipment } from '../src/modules/orders/service';

const SINCE = process.argv[2] ?? '2026-09-13';

async function main() {
  if (!env.DELHIVERY_API_KEY) {
    console.error('DELHIVERY_API_KEY not set — aborting, nothing written.');
    process.exit(1);
  }

  const shipments = await db.shipment.findMany({
    where: {
      delhiveryWaybill: { not: null },
      order: { createdAt: { gte: new Date(`${SINCE}T00:00:00.000Z`) } },
    },
    include: { order: { select: { orderNumber: true, status: true } } },
  });

  console.log(`Found ${shipments.length} shipments since ${SINCE}.\n`);

  for (const s of shipments) {
    const res = await fetch(`${env.DELHIVERY_BASE_URL}/api/v1/packages/json/?waybill=${s.delhiveryWaybill}`, {
      headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}` },
    });
    if (!res.ok) {
      console.log(`${s.order.orderNumber} | waybill=${s.delhiveryWaybill} | Delhivery API error ${res.status} — skipped`);
      continue;
    }

    const data = (await res.json()) as { ShipmentData?: Array<{ Shipment: { Status: { Status: string } } }> };
    const rawStatus = data.ShipmentData?.[0]?.Shipment?.Status?.Status;
    if (!rawStatus) {
      console.log(`${s.order.orderNumber} | waybill=${s.delhiveryWaybill} | no status in Delhivery response — skipped`);
      continue;
    }

    const mapped = mapDelhiveryStatus(rawStatus);
    const orderBefore = s.order.status;

    if (mapped !== s.status) {
      await db.shipment.update({ where: { id: s.id }, data: { status: mapped } });
    }
    await syncOrderStatusFromShipment(s.orderId, mapped);

    const orderAfter = (await db.order.findUnique({ where: { id: s.orderId }, select: { status: true } }))!.status;

    console.log(
      `${s.order.orderNumber} | waybill=${s.delhiveryWaybill} | Delhivery="${rawStatus}" -> Shipment ${s.status}->${mapped} | Order ${orderBefore}->${orderAfter}`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
