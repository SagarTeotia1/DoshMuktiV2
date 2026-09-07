import { db } from '../../shared/db/client';
import type { OrderStatus } from '@prisma/client';
import {
  createShipment,
  fetchShippingLabel,
  raisePickupRequest,
  takeNdrAction,
  updateEwaybill,
  type NdrAction,
} from '../../shared/integrations/delhivery/client';
import { refundPayment } from '../../shared/integrations/razorpay/client';
import { logger } from '../../shared/logger/pino';

export class NoWaybillError extends Error {
  constructor() {
    super('This order has no Delhivery waybill yet — shipment may not be booked.');
    this.name = 'NoWaybillError';
  }
}

async function getWaybillOrThrow(orderId: string): Promise<string> {
  const shipment = await db.shipment.findUnique({ where: { orderId } });
  if (!shipment?.delhiveryWaybill) throw new NoWaybillError();
  return shipment.delhiveryWaybill;
}

type BookableAddress = { line1: string; line2?: string; city: string; state: string; pincode: string };

// Manual retry path for the auto-book on payment.captured (see webhooks/service.ts) —
// that one is fire-and-forget and can fail silently (Delhivery rejection, network blip).
// This lets Admin re-trigger it once whatever caused the rejection is fixed, without
// needing a DB console. Refuses if a shipment already exists — never books twice.
export async function bookOrderShipment(orderId: string): Promise<{ waybill: string }> {
  const existing = await db.shipment.findUnique({ where: { orderId } });
  if (existing?.delhiveryWaybill) throw new Error('This order already has a Delhivery shipment booked.');

  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: true } } } });
  if (!order) throw new Error('Order not found');

  const shipment = await createShipment({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    address: order.shippingAddress as unknown as BookableAddress,
    totalAmount: Number(order.total),
    weight: order.items.reduce((sum, i) => sum + i.variant.weight * i.quantity, 0),
  });
  if (!shipment) throw new Error('Delhivery rejected the shipment — check wallet balance and address details');

  if (existing) {
    await db.shipment.update({ where: { orderId }, data: { delhiveryWaybill: shipment.waybill, status: 'BOOKED' } });
  } else {
    await db.shipment.create({ data: { orderId, delhiveryWaybill: shipment.waybill, status: 'BOOKED' } });
  }
  return shipment;
}

export async function getShipmentLabel(orderId: string): Promise<{ pdfUrl: string }> {
  const waybill = await getWaybillOrThrow(orderId);
  const label = await fetchShippingLabel(waybill);
  if (!label) throw new Error('Delhivery did not return a label for this waybill');
  return label;
}

export async function raiseOrderPickup(
  orderId: string,
  params: { pickupDate: string; pickupTime: string; expectedPackageCount: number }
): Promise<{ pickupId?: string }> {
  await getWaybillOrThrow(orderId); // pickup only makes sense once a shipment is booked
  const result = await raisePickupRequest(params);
  if (!result.success) throw new Error(result.error ?? 'Pickup request failed');

  await db.shipment.update({ where: { orderId }, data: { pickupRequestedAt: new Date() } });
  return { pickupId: result.pickupId };
}

export async function takeOrderNdrAction(
  orderId: string,
  params: { action: NdrAction; reattemptDate?: string; comment?: string }
): Promise<void> {
  const waybill = await getWaybillOrThrow(orderId);
  const result = await takeNdrAction({ waybill, ...params });
  if (!result.success) throw new Error(result.error ?? 'NDR action failed');

  // Reflect the NDR outcome locally too — previously this only told Delhivery, so
  // Admin's "Shipment status" line stayed stale (still IN_TRANSIT/BOOKED) even after
  // a failed delivery attempt was acted on. RTO is a real return-to-warehouse outcome;
  // a reattempt means the last attempt failed but delivery is still being retried.
  await db.shipment.update({
    where: { orderId },
    data: { status: params.action === 'RTO' ? 'RETURNED' : 'FAILED' },
  });
}

export async function updateOrderEwaybill(orderId: string, ewaybillNumber: string): Promise<void> {
  const waybill = await getWaybillOrThrow(orderId);
  const result = await updateEwaybill({ waybill, ewaybillNumber });
  if (!result.success) throw new Error(result.error ?? 'E-way bill update failed');

  await db.shipment.update({ where: { orderId }, data: { ewaybillNumber } });
}

// Order/product images so the storefront's order pages can show real thumbnails
// (Amazon/Flipkart-style) instead of a generic icon per line item.
const itemsWithProductImage = { items: { include: { variant: { include: { product: true } } } } } as const;

export async function getOrderByNumber(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    include: { ...itemsWithProductImage, payment: true, shipment: true },
  });
}

export async function listOrdersForUser(userId: string) {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { ...itemsWithProductImage, payment: true, shipment: true },
  });
}

export async function listOrdersByPhone(phone: string) {
  return db.order.findMany({
    where: { customerPhone: phone },
    orderBy: { createdAt: 'desc' },
    include: { ...itemsWithProductImage, payment: true, shipment: true },
  });
}

export async function getOrderById(id: string) {
  return db.order.findUnique({
    where: { id },
    include: { items: { include: { variant: true } }, payment: true, shipment: true, statusLog: { orderBy: { createdAt: 'desc' } } },
  });
}

export async function listOrdersForAdmin(query: { status?: OrderStatus; page: number; limit: number }) {
  const where = query.status ? { status: query.status } : {};
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { items: true, payment: true, shipment: true },
    }),
    db.order.count({ where }),
  ]);
  return { orders, total, pages: Math.ceil(total / query.limit), page: query.page };
}

type GstVariantSnapshot = { sku?: string; productName?: string; gstRate?: number | null };

// GST is an inclusive breakup of amounts already charged (see invoice.ts's identical
// formula) — purely a reporting computation for the CA, never touches order pricing/total.
function computeItemGst(lineTotal: number, gstRate: number): { taxableValue: number; gstAmount: number } {
  const taxableValue = lineTotal / (1 + gstRate / 100);
  return { taxableValue, gstAmount: lineTotal - taxableValue };
}

// Inclusive GST breakup of an order's items, for the public order-tracking response —
// same formula as the CA-facing GST report and the invoice PDF, so all three can never
// disagree. gstAmount is 0 (and taxableValue == the summed line totals) when no item
// carries a gstRate, so the UI can hide the line entirely.
export function computeOrderGst(items: Array<{ priceAtPurchase: unknown; quantity: number; variantSnapshot: unknown }>): {
  taxableValue: number;
  gstAmount: number;
} {
  let taxableValue = 0;
  let gstAmount = 0;
  for (const item of items) {
    const lineTotal = Number(item.priceAtPurchase) * item.quantity;
    const snapshot = item.variantSnapshot as unknown as GstVariantSnapshot;
    const gstRate = typeof snapshot?.gstRate === 'number' ? snapshot.gstRate : null;
    if (gstRate === null) {
      taxableValue += lineTotal;
      continue;
    }
    const breakup = computeItemGst(lineTotal, gstRate);
    taxableValue += breakup.taxableValue;
    gstAmount += breakup.gstAmount;
  }
  return { taxableValue, gstAmount };
}

export interface GstReportItemRow {
  sku: string;
  productName: string;
  quantity: number;
  gstRate: number;
  lineTotal: number;
  taxableValue: number;
  gstAmount: number;
}

export interface GstReportOrderRow {
  orderNumber: string;
  orderDate: string;
  items: GstReportItemRow[];
  orderTaxableValue: number;
  orderGstAmount: number;
}

export interface GstReport {
  from: string;
  to: string;
  orders: GstReportOrderRow[];
  totalTaxableValue: number;
  totalGstAmount: number;
}

// Every order in [from, to] (inclusive, by createdAt) with at least one item whose
// variantSnapshot.gstRate is a set number — orders with no GST-rated items are omitted
// entirely rather than showing as zero rows.
export async function getGstReport(from: string, to: string): Promise<GstReport> {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);

  const orders = await db.order.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate } },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  });

  const reportOrders: GstReportOrderRow[] = [];
  let totalTaxableValue = 0;
  let totalGstAmount = 0;

  for (const order of orders) {
    const itemRows: GstReportItemRow[] = [];
    let orderTaxableValue = 0;
    let orderGstAmount = 0;

    for (const item of order.items) {
      const snapshot = item.variantSnapshot as unknown as GstVariantSnapshot;
      const gstRate = typeof snapshot.gstRate === 'number' ? snapshot.gstRate : null;
      if (gstRate === null) continue;

      const lineTotal = Number(item.priceAtPurchase) * item.quantity;
      const { taxableValue, gstAmount } = computeItemGst(lineTotal, gstRate);
      itemRows.push({
        sku: snapshot.sku ?? '-',
        productName: snapshot.productName ?? '-',
        quantity: item.quantity,
        gstRate,
        lineTotal,
        taxableValue,
        gstAmount,
      });
      orderTaxableValue += taxableValue;
      orderGstAmount += gstAmount;
    }

    if (itemRows.length === 0) continue;

    reportOrders.push({
      orderNumber: order.orderNumber,
      orderDate: order.createdAt.toISOString(),
      items: itemRows,
      orderTaxableValue,
      orderGstAmount,
    });
    totalTaxableValue += orderTaxableValue;
    totalGstAmount += orderGstAmount;
  }

  return { from, to, orders: reportOrders, totalTaxableValue, totalGstAmount };
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  note: string | undefined,
  admin: string
): Promise<{ order: Awaited<ReturnType<typeof db.order.update>>; refundError?: string }> {
  const order = await db.$transaction(async (tx) => {
    const existing = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
    await tx.orderStatusLog.create({
      data: { orderId, from: existing.status, to: newStatus, note, createdBy: admin },
    });
    return updated;
  });

  // Cancelling always commits regardless of what happens below — a stuck refund must
  // never leave stock/order state in limbo. Razorpay's refund call happens outside the
  // transaction on purpose (never hold a DB connection open across a network call).
  if (newStatus !== 'CANCELLED') return { order };

  const payment = await db.payment.findUnique({ where: { orderId } });
  if (!payment || payment.status !== 'CAPTURED' || !payment.razorpayPaymentId || payment.refundedAt) {
    return { order }; // never paid, already refunded, or payment failed — nothing to refund
  }

  try {
    const { refundId } = await refundPayment(payment.razorpayPaymentId, Number(payment.amount));
    await db.payment.update({
      where: { orderId },
      data: { status: 'REFUNDED', razorpayRefundId: refundId, refundedAt: new Date() },
    });
    // Order status itself moves to REFUNDED once money is actually back with the
    // customer — CANCELLED alone left the order looking stuck even when the refund
    // had gone through, since Payment's REFUNDED status wasn't visible on the badge.
    const refunded = await db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
      await tx.orderStatusLog.create({
        data: { orderId, from: 'CANCELLED', to: 'REFUNDED', note: `Razorpay refund ${refundId}`, createdBy: admin },
      });
      return updated;
    });
    return { order: refunded };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Refund failed — retry from the Razorpay dashboard';
    logger.error({ err, orderId, orderNumber: order.orderNumber }, 'Refund failed after order cancellation');
    // Order status stays CANCELLED (never faked as REFUNDED), but the failure needs to
    // survive a page reload, not just the one toast the admin who clicked Cancel saw —
    // a same-status log entry is how "refund pending/failed" shows up in Status History.
    await db.orderStatusLog.create({
      data: { orderId, from: 'CANCELLED', to: 'CANCELLED', note: `Refund failed: ${reason}`, createdBy: admin },
    });
    return { order, refundError: reason };
  }
}
