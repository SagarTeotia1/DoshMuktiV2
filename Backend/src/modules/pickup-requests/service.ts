import { db } from '../../shared/db/client';
import { raisePickupRequest } from '../../shared/integrations/delhivery/client';

// Every BOOKED shipment not yet swept into a pickup batch — this is the set a new
// pickup request covers. Never call Delhivery per-order: one courier visit picks up
// the whole day's bag, so the request must carry the real count of what's waiting.
// Flagged shipments (bad address / high risk) are excluded — a courier shouldn't be
// sent for one until an admin resolves it (see takeOrderNdrAction, which clears the
// flag), otherwise every batch wastes a pickup slot on a package that's going to NDR
// again anyway.
async function getPendingShipments() {
  return db.shipment.findMany({
    where: { status: 'BOOKED', pickupRequestId: null, riskFlag: null },
    select: { id: true },
  });
}

export async function getPendingPickupCount(): Promise<number> {
  return db.shipment.count({ where: { status: 'BOOKED', pickupRequestId: null, riskFlag: null } });
}

export class NoPendingShipmentsError extends Error {
  constructor() {
    super('No booked shipments are waiting for pickup.');
    this.name = 'NoPendingShipmentsError';
  }
}

// Raises exactly one Delhivery pickup slot for every shipment currently waiting —
// not one call per order. The count sent to Delhivery, and the shipments linked
// afterwards, are the same query result, so they can never drift apart.
export async function createPickupRequest(
  params: { pickupDate: string; pickupTime: string },
  createdBy: string
): Promise<{ id: string; delhiveryPickupId?: string; expectedPackageCount: number }> {
  const pending = await getPendingShipments();
  if (pending.length === 0) throw new NoPendingShipmentsError();

  const result = await raisePickupRequest({
    pickupDate: params.pickupDate,
    pickupTime: params.pickupTime,
    expectedPackageCount: pending.length,
  });
  if (!result.success) throw new Error(result.error ?? 'Pickup request failed');

  const pickupRequest = await db.$transaction(async (tx) => {
    const created = await tx.pickupRequest.create({
      data: {
        pickupDate: params.pickupDate,
        pickupTime: params.pickupTime,
        expectedPackageCount: pending.length,
        delhiveryPickupId: result.pickupId,
        createdBy,
      },
    });
    // Re-scoped to the exact shipments counted above — anything booked in the gap
    // between that count and this write waits for the next batch instead of being
    // silently claimed by a request Delhivery was never told about it.
    await tx.shipment.updateMany({
      where: { id: { in: pending.map((s) => s.id) } },
      data: { pickupRequestId: created.id },
    });
    return created;
  });

  return {
    id: pickupRequest.id,
    delhiveryPickupId: pickupRequest.delhiveryPickupId ?? undefined,
    expectedPackageCount: pickupRequest.expectedPackageCount,
  };
}

export async function listPickupRequests(query: { page: number; limit: number }) {
  const [requests, total] = await Promise.all([
    db.pickupRequest.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { shipments: { select: { orderId: true } } },
    }),
    db.pickupRequest.count(),
  ]);
  return { requests, total, pages: Math.ceil(total / query.limit), page: query.page };
}
