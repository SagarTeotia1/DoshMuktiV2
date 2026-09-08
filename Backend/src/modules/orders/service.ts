import { db } from '../../shared/db/client';
import { Prisma, type OrderStatus } from '@prisma/client';
import {
  createShipment,
  fetchShippingLabel,
  takeNdrAction,
  updateEwaybill,
  type NdrAction,
} from '../../shared/integrations/delhivery/client';
import { refundPayment } from '../../shared/integrations/razorpay/client';
import { logger } from '../../shared/logger/pino';
import { addItemToCart } from '../cart/service';
import { releaseCouponUsageTx } from '../coupons/service';
import { invalidateProductCaches } from '../products/service';

export class OrderNotResumableError extends Error {
  constructor() {
    super('This order is no longer pending payment.');
    this.name = 'OrderNotResumableError';
  }
}

// Shared by resumeOrder below and jobs/release-holds.ts — both need to undo the exact
// same atomic stock deduction that initiateCheckout makes at order-creation time (see
// checkout/service.ts), not just flip a status flag. Never call this on anything but
// a still-PENDING_PAYMENT order — it unconditionally restores stock as if a real
// reservation is being given up.
export async function cancelPendingOrderTx(
  tx: Prisma.TransactionClient,
  order: { id: string; status: OrderStatus; couponId: string | null; items: Array<{ variantId: string; quantity: number }> },
  note: string,
  createdBy: string
): Promise<void> {
  for (const item of order.items) {
    await tx.$executeRaw`
      UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${item.quantity} WHERE id = ${item.variantId}
    `;
    await tx.stockMovement.create({
      data: { variantId: item.variantId, change: item.quantity, reason: 'RESERVATION_RELEASED', orderId: order.id, createdBy },
    });
  }
  if (order.couponId) {
    await releaseCouponUsageTx(tx, order.couponId);
  }
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'CANCELLED', statusLog: { create: { from: order.status, to: 'CANCELLED', createdBy, note } } },
  });
}

// A cancelled/failed Razorpay payment left the order stuck at PENDING_PAYMENT with no
// way back in — the order itself was never designed to be paid twice, so instead of
// trying to resurrect the same Order row, this re-adds its items into the customer's
// live cart and lets them go through checkout again normally (new order, new payment).
// Item-level failures (stock sold out, variant deactivated since) are skipped rather
// than aborting the whole resume — better to let the customer see partial results and
// adjust than to block them entirely because one line item is now unavailable.
//
// Cancels the old order FIRST, before touching the cart — initiateCheckout deducts
// stockQuantity at order creation, not at payment capture, so the stuck order is still
// holding a real reservation. Without releasing it here, the customer's own abandoned
// attempt could make their retry fail as "out of stock" against nothing but their own
// earlier hold (worst case if stock is down to the last unit), or silently double-lock
// the same units until release-holds' cron eventually notices — which assumes that
// cron is even wired up in this deploy.
export async function resumeOrder(orderNumber: string, sessionId: string): Promise<{ addedCount: number; skippedCount: number }> {
  const order = await db.order.findUnique({ where: { orderNumber }, include: { items: true } });
  if (!order) throw new Error('Order not found');
  if (order.status !== 'PENDING_PAYMENT') throw new OrderNotResumableError();

  await db.$transaction((tx) => cancelPendingOrderTx(tx, order, 'Cancelled to resume payment', 'system'));
  await invalidateProductCaches();

  let addedCount = 0;
  let skippedCount = 0;
  for (const item of order.items) {
    try {
      await addItemToCart(sessionId, { variantId: item.variantId, quantity: item.quantity });
      addedCount++;
    } catch {
      skippedCount++;
    }
  }
  return { addedCount, skippedCount };
}

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
    data: { status: params.action === 'RTO' ? 'RETURNED' : 'FAILED', riskFlag: null, riskReason: null },
  });
}

// Manual override for when Delhivery's NDR text doesn't hit the keyword match, or an
// admin spots the problem before Delhivery does — pulls the shipment out of the pickup
// batch queue immediately (see pickup-requests/service.ts). Passing riskFlag: null clears
// it, same effect as resolving via an NDR action.
export async function setShipmentRiskFlag(
  orderId: string,
  params: { riskFlag: 'BAD_ADDRESS' | 'HIGH_RISK' | null; riskReason?: string }
): Promise<void> {
  await db.shipment.update({
    where: { orderId },
    data: { riskFlag: params.riskFlag, riskReason: params.riskFlag ? params.riskReason ?? null : null },
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

  // Marks the order REFUNDED once Payment already carries a refund id — shared by both
  // the request that actually called Razorpay and a concurrent duplicate that lost the
  // race (see the "already refunded" branch below). Re-running this is harmless: it's
  // the same transition either way, just logged twice if it genuinely races.
  async function markOrderRefunded(refundId: string) {
    return db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
      await tx.orderStatusLog.create({
        data: { orderId, from: 'CANCELLED', to: 'REFUNDED', note: `Razorpay refund ${refundId}`, createdBy: admin },
      });
      return updated;
    });
  }

  try {
    const { refundId } = await refundPayment(payment.razorpayPaymentId, Number(payment.amount));
    await db.payment.update({
      where: { orderId },
      data: { status: 'REFUNDED', razorpayRefundId: refundId, refundedAt: new Date() },
    });
    return { order: await markOrderRefunded(refundId) };
  } catch (err) {
    // Razorpay's SDK throws a plain object here (`{statusCode, error: {code, description}}`),
    // never an Error — reading err.message on it silently produced nothing and always fell
    // through to the generic fallback, hiding the real reason from the admin.
    const razorpayError = (err as { error?: { description?: string; code?: string } } | null)?.error;
    const reason = razorpayError?.description ?? (err instanceof Error ? err.message : 'Refund failed — retry from the Razorpay dashboard');

    // A near-simultaneous duplicate request (double-click, double-submit) can lose this
    // exact race: the sibling request's refund already landed at Razorpay by the time
    // this one's call goes out, so Razorpay correctly rejects it — that's not a real
    // failure, just this request losing to its sibling. Reconcile from the DB instead
    // of reporting it as broken.
    if (razorpayError?.code === 'BAD_REQUEST_ERROR' && /already.*refunded/i.test(reason)) {
      const fresh = await db.payment.findUnique({ where: { orderId } });
      if (fresh?.razorpayRefundId) return { order: await markOrderRefunded(fresh.razorpayRefundId) };
    }

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
