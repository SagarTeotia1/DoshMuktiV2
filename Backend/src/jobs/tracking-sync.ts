import type { ShipmentStatus } from '@prisma/client';
import { db } from '../shared/db/client';
import { env } from '../config/env';
import { redis } from '../shared/cache/client';
import { cacheKeys } from '../shared/cache/keys';
import { logger } from '../shared/logger/pino';
import { syncOrderStatusFromShipment } from '../modules/orders/service';
import { mapDelhiveryStatus, handleEkartStatusUpdate } from '../modules/webhooks/service';
import { fetchEkartTrack } from '../shared/integrations/ekart/client';

// What a sync run looks at:
//   all       - every open shipment (the Cloud Scheduler run).
//   shipped   - ONLY orders currently PACKED: "has the carrier picked it up yet?"
//               -> advances the order to SHIPPED (or straight to DELIVERED).
//   delivered - ONLY orders currently SHIPPED: "has it been delivered yet?"
//               -> advances the order to DELIVERED.
// The two manual modes select by Order.status (what the admin sees on the orders list),
// not by Shipment.status, so they match exactly the rows the admin is looking at.
export type TrackingSyncMode = 'all' | 'shipped' | 'delivered';

const CRON_SHIPMENT_STATUSES: ShipmentStatus[] = ['BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'];
const MANUAL_ORDER_STATUS = { shipped: 'PACKED', delivered: 'SHIPPED' } as const;

// Ekart additionally re-polls FAILED (NDR) parcels, but only on the full sweep.
const EKART_EXTRA_STATUSES: ShipmentStatus[] = ['FAILED'];

// A manual sweep skips parcels polled in the last RECENTLY_CHECKED_MS. That is what makes
// "did everything get checked?" answerable: each click shrinks the pending count, and it
// reaches 0 once every PACKED/SHIPPED order has been polled. Without it, a parcel that
// legitimately stays PACKED (not picked up yet) would count as pending forever.
const RECENTLY_CHECKED_MS = 30 * 60 * 1000;

// Per-carrier cap on parcels polled in ONE run. Admin buttons use the small cap so a click
// is always a short, bounded request (never "poll every order and hope"); the least
// recently synced parcels go first, so repeated clicks walk through the whole backlog.
// The twice-a-day scheduler run uses the larger cap.
export const MANUAL_SYNC_LIMIT = 30;
export const CRON_SYNC_LIMIT = 200;

const CONCURRENCY = 5; // parcels polled in parallel — fast, without hammering the carrier
const REQUEST_TIMEOUT_MS = 10_000; // a hung carrier call must not hang the whole sweep
const LOCK_TTL_SECONDS = 300; // crash safety: a dead run can never hold the lock forever

export class SyncBusyError extends Error {
  constructor() {
    super('A tracking sync is already running — try again in a minute.');
    this.name = 'SyncBusyError';
  }
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<boolean>): Promise<number> {
  let index = 0;
  let ok = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]!;
      try {
        if (await worker(item)) ok++;
      } catch (err) {
        // One bad parcel (network blip, bad JSON) must not stop the rest of the sweep.
        logger.warn({ err }, 'Tracking sync: parcel failed, continuing');
      }
    }
  });
  await Promise.all(runners);
  return ok;
}

// Single-flight across ALL instances (Redis, not in-process): double-clicks, two admins,
// or the cron firing mid-click all collapse into one run instead of N parallel sweeps
// hammering the carrier APIs and racing on the same rows. incr() is atomic, so exactly
// one caller sees 1. The TTL frees the lock if the instance dies mid-run.
async function withSyncLock<T>(fn: () => Promise<T>): Promise<T> {
  const key = cacheKeys.cronLock('tracking-sync');
  const count = await redis.incr(key, LOCK_TTL_SECONDS);
  if (count !== 1) throw new SyncBusyError();
  try {
    return await fn();
  } finally {
    await redis.del(key).catch(() => undefined);
  }
}

// Polls carriers for open shipments and updates tracking status. Hit by Cloud Scheduler
// twice a day and on demand via Admin's sync buttons — Delhivery's own webhook
// (webhooks/delhivery) is the primary path, this is the fallback in case a push is missed.
export interface TrackingSyncResult {
  synced: number;
  checked: number;
  totalOpen: number; // parcels waiting to be checked BEFORE this run; totalOpen - checked = still to go
}

export async function syncOpenShipments(
  mode: TrackingSyncMode = 'all',
  limit: number = CRON_SYNC_LIMIT,
): Promise<TrackingSyncResult> {
  return withSyncLock(async () => {
    const ekart = await syncEkartShipments(mode, limit);
    const delhivery = env.DELHIVERY_API_KEY ? await syncDelhiveryShipments(mode, limit) : { synced: 0, checked: 0, totalOpen: 0 };
    return {
      synced: ekart.synced + delhivery.synced,
      checked: ekart.checked + delhivery.checked,
      totalOpen: ekart.totalOpen + delhivery.totalOpen,
    };
  });
}

// Oldest-touched first. Every polled parcel gets its row written (even with an unchanged
// status) so updatedAt moves and it drops out of the pending set — otherwise a parcel the
// carrier keeps failing on would sit at the front forever and starve the rest.
function nextBatch(carrier: 'DELHIVERY' | 'EKART', mode: TrackingSyncMode, limit: number) {
  const base = { delhiveryWaybill: { not: null }, carrier } as const;
  const where =
    mode === 'all'
      ? { ...base, status: { in: carrier === 'EKART' ? [...CRON_SHIPMENT_STATUSES, ...EKART_EXTRA_STATUSES] : CRON_SHIPMENT_STATUSES } }
      : {
          ...base,
          order: { status: MANUAL_ORDER_STATUS[mode] },
          updatedAt: { lt: new Date(Date.now() - RECENTLY_CHECKED_MS) },
        };
  return Promise.all([
    db.shipment.findMany({ where, orderBy: { updatedAt: 'asc' }, take: limit }),
    db.shipment.count({ where }),
  ]);
}

async function syncDelhiveryShipments(mode: TrackingSyncMode, limit: number): Promise<TrackingSyncResult> {
  const [open, total] = await nextBatch('DELHIVERY', mode, limit);

  const synced = await runPool(open, async (shipment) => {
    // Move to the back of the queue even if the carrier call below fails.
    await db.shipment.update({ where: { id: shipment.id }, data: { status: shipment.status } });
    const res = await fetch(`${env.DELHIVERY_BASE_URL}/api/v1/packages/json/?waybill=${shipment.delhiveryWaybill}`, {
      headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as { ShipmentData?: Array<{ Shipment: { Status: { Status: string } } }> };
    const status = data.ShipmentData?.[0]?.Shipment?.Status?.Status;
    if (!status) return false;

    const mappedStatus = mapDelhiveryStatus(status);
    await db.shipment.update({ where: { id: shipment.id }, data: { status: mappedStatus } });
    await syncOrderStatusFromShipment(shipment.orderId, mappedStatus);
    return true;
  });
  return { synced, checked: open.length, totalOpen: total };
}

// Ekart fallback for a missed track_updated push. Uses Ekart's open tracking endpoint
// (no credentials needed) and feeds the same handler the webhook uses.
async function syncEkartShipments(mode: TrackingSyncMode, limit: number): Promise<TrackingSyncResult> {
  const [open, total] = await nextBatch('EKART', mode, limit);

  const synced = await runPool(open, async (shipment) => {
    await db.shipment.update({ where: { id: shipment.id }, data: { status: shipment.status } });
    const track = await fetchEkartTrack(shipment.delhiveryWaybill!);
    if (!track) return false;
    await handleEkartStatusUpdate(shipment.delhiveryWaybill!, {
      status: track.status,
      location: track.location,
      description: track.desc,
      timestamp: new Date(track.ctime).toISOString(),
      ndrStatus: track.ndrStatus,
    });
    return true;
  });
  return { synced, checked: open.length, totalOpen: total };
}
