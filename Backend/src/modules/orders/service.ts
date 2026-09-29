import { db } from '../../shared/db/client';
import { Prisma, type OrderStatus } from '@prisma/client';
import {
  createShipment,
  fetchShippingLabel,
  takeNdrAction,
  updateEwaybill,
  calculateShippingCost as fetchDelhiveryShippingCost,
  type NdrAction,
} from '../../shared/integrations/delhivery/client';
import { fixLabelPdf, type LabelSize } from '../../shared/integrations/delhivery/labelPdf';
import { refundPayment as refundRazorpayPayment } from '../../shared/integrations/razorpay/client';
import { refundPayment as refundHdfcPayment, APIError as HdfcAPIError } from '../../shared/integrations/hdfc-smartgateway/client';
import { logger } from '../../shared/logger/pino';
import { addItemToCart } from '../cart/service';
import { releaseCouponUsageTx } from '../coupons/service';
import { invalidateProductCaches } from '../products/service';
import { PACKAGING_WEIGHT_GRAMS } from '../../shared/constants/purposes';
import { chooseCarrier, type CarrierId } from '../../shared/shipping/carrier';
import { createEkartShipment } from '../../shared/integrations/ekart/client';
import { env } from '../../config/env';

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
export async function bookOrderShipment(orderId: string): Promise<{ waybill: string; carrier: CarrierId }> {
  const existing = await db.shipment.findUnique({ where: { orderId } });
  if (existing?.delhiveryWaybill) throw new Error('This order already has a shipment booked.');

  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: true } } } });
  if (!order) throw new Error('Order not found');

  // Declared weight must match the real packed parcel (all items + packaging go into
  // ONE box on ONE waybill) — under-declaring risks the carrier re-weighing and billing
  // the difference. See PACKAGING_WEIGHT_GRAMS's comment. An admin-set
  // packageWeightOverride (see updateOrderPackageWeight) always wins — it means someone
  // actually weighed this specific box and knows better than the item-sum estimate.
  const weight =
    order.packageWeightOverride ??
    order.items.reduce((sum, i) => sum + i.variant.weight * i.quantity, 0) + PACKAGING_WEIGHT_GRAMS;
  const address = order.shippingAddress as unknown as BookableAddress;
  const carrier = chooseCarrier(order.paymentMethod, weight);

  const result =
    carrier === 'EKART'
      ? await createEkartShipment({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          address,
          weight,
          codAmount: Number(order.codAmountDue),
          orderTotal: Number(order.total),
        })
      : await createShipment({
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          address,
          weight,
        });
  if (!result) throw new Error(`${carrier} did not return a waybill — check API key/wallet balance and address details`);
  if ('error' in result) throw new Error(result.error);

  if (existing) {
    await db.shipment.update({ where: { orderId }, data: { delhiveryWaybill: result.waybill, carrier, status: 'BOOKED' } });
  } else {
    await db.shipment.create({ data: { orderId, delhiveryWaybill: result.waybill, carrier, status: 'BOOKED' } });
  }

  // The re-quote calls Delhivery's rate calculator — meaningless for an Ekart parcel.
  if (carrier === 'DELHIVERY') void quoteBookingShippingCost(orderId, weight, address.pincode);

  return { waybill: result.waybill, carrier };
}

// Best-effort: re-quotes Delhivery's rate calculator the moment a shipment is booked,
// with the exact weight just sent in the booking call (so it reflects a
// packageWeightOverride set before booking, unlike actualShippingCost which is frozen
// at checkout). Shared by bookOrderShipment above and the payment.captured auto-book in
// webhooks/service.ts. Never throws into the caller — a failed re-quote just leaves
// bookingShippingCost null; it never blocks the shipment booking itself.
export async function quoteBookingShippingCost(orderId: string, weightGrams: number, destPincode: string): Promise<void> {
  try {
    const result = await fetchDelhiveryShippingCost({
      originPincode: env.DELHIVERY_WAREHOUSE_PINCODE,
      destPincode,
      weightGrams,
      paymentMode: 'Pre-paid',
    });
    if (!result) return;
    await db.order.update({ where: { id: orderId }, data: { bookingShippingCost: result.amount } });
  } catch (err) {
    logger.error({ err, orderId }, 'Failed to fetch booking-time Delhivery shipping cost');
  }
}

// Grams, or null to fall back to the auto-calculated weight (item sum + packaging) again.
// Only meaningful before booking — bookOrderShipment/the webhook auto-book read this at
// the moment they call Delhivery, so setting it after a shipment is already booked has no
// effect on that waybill (Delhivery doesn't support editing a shipment's declared weight
// post-booking; cancel and rebook if it was wrong).
export async function updateOrderPackageWeight(orderId: string, weight: number | null): Promise<void> {
  await db.order.update({ where: { id: orderId }, data: { packageWeightOverride: weight } });
}

export async function getShipmentLabel(orderId: string, size: LabelSize): Promise<{ pdfBase64: string }> {
  const waybill = await getWaybillOrThrow(orderId);
  const label = await fetchShippingLabel(waybill);
  if (!label) throw new Error('Delhivery did not return a label for this waybill');

  const res = await fetch(label.pdfUrl);
  if (!res.ok) throw new Error('Could not download label PDF from Delhivery');
  const sourceBytes = Buffer.from(await res.arrayBuffer());

  const fixedBytes = await fixLabelPdf(sourceBytes, size);
  return { pdfBase64: fixedBytes.toString('base64') };
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

// The customer-facing "Your Orders" list — CANCELLED and PENDING_PAYMENT are excluded
// here deliberately: a stuck/abandoned checkout attempt or a cancelled order is not
// something a customer needs cluttering their order history. (Support's phone-lookup
// path, listOrdersByPhone below, intentionally shows every status — troubleshooting a
// stuck order requires seeing it.)
export async function listOrdersForUser(userId: string) {
  return db.order.findMany({
    where: { userId, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } },
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
    include: {
      items: { include: { variant: true } },
      payment: true,
      shipment: true,
      statusLog: { orderBy: { createdAt: 'desc' } },
      coupon: true,
    },
  });
}

export async function listOrdersForAdmin(query: { status?: OrderStatus; from?: string; to?: string; page: number; limit: number }) {
  const where: Prisma.OrderWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
      ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    };
  }
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
// entirely rather than showing as zero rows. Restricted to orders whose payment actually
// CAPTURED — a PENDING_PAYMENT, CANCELLED, or REFUNDED order never collected real GST-able
// revenue and must never appear on a tax filing, regardless of how far it got through checkout.
export async function getGstReport(from: string, to: string): Promise<GstReport> {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);

  const orders = await db.order.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate }, payment: { status: 'CAPTURED' } },
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

      const isFreeAttar =
        snapshot.sku === 'ATTAR-25-ML-DEFAULT' ||
        snapshot.productName === 'ATTAR-25-ML-DEFAULT' ||
        (!snapshot.productName && snapshot.sku?.includes('ATTAR'));
      const sku = isFreeAttar ? 'FREE ATTAR' : (snapshot.sku ?? '-');
      const productName = isFreeAttar ? 'FREE ATTAR' : (snapshot.productName ?? '-');

      const lineTotal = Number(item.priceAtPurchase) * item.quantity;
      const { taxableValue, gstAmount } = computeItemGst(lineTotal, gstRate);

      itemRows.push({
        sku,
        productName,
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
  const isHdfc = payment?.gateway === 'HDFC';
  const gatewayName = isHdfc ? 'SmartGateway' : 'Razorpay';
  const paidRef = isHdfc ? payment?.hdfcOrderId : payment?.razorpayPaymentId;
  if (!payment || payment.status !== 'CAPTURED' || !paidRef || payment.refundedAt) {
    return { order }; // never paid, already refunded, or payment failed — nothing to refund
  }

  // Marks the order REFUNDED once Payment already carries a refund id — shared by both
  // the request that actually called the gateway and a concurrent duplicate that lost the
  // race. Re-running this is harmless: it's the same transition either way.
  async function markOrderRefunded(refundId: string, status?: string) {
    return db.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: orderId }, data: { status: 'REFUNDED' } });
      await tx.orderStatusLog.create({
        data: { orderId, from: 'CANCELLED', to: 'REFUNDED', note: `${gatewayName} refund ${refundId}${status ? ` (${status})` : ''}`, createdBy: admin },
      });
      return updated;
    });
  }

  // Refund amount is payment.amount — for COD that's only the advance actually paid online.
  try {
    let refundId: string;
    let refundStatus: string | undefined;
    if (isHdfc) {
      // Deterministic: SmartGateway rejects a reused unique_request_id, so a retry of this
      // exact refund must send the SAME id to stay idempotent. Must be <21 chars.
      const result = await refundHdfcPayment(paidRef, Number(payment.amount), `r_${order.orderNumber}`);
      refundId = result.refundId;
      refundStatus = result.status;
    } else {
      refundId = (await refundRazorpayPayment(paidRef, Number(payment.amount))).refundId;
    }
    await db.payment.update({
      where: { orderId },
      data: { status: 'REFUNDED', refundedAt: new Date(), ...(isHdfc ? { hdfcRefundId: refundId } : { razorpayRefundId: refundId }) },
    });
    return { order: await markOrderRefunded(refundId, refundStatus) };
  } catch (err) {
    // Razorpay's SDK throws a plain object (`{statusCode, error: {code, description}}`),
    // never an Error; SmartGateway's SDK throws an APIError with error_message.
    const razorpayError = (err as { error?: { description?: string; code?: string } } | null)?.error;
    const reason = isHdfc
      ? (err instanceof HdfcAPIError ? err.error_message : undefined) ?? (err instanceof Error ? err.message : 'Refund failed — retry from the SmartGateway dashboard')
      : razorpayError?.description ?? (err instanceof Error ? err.message : 'Refund failed — retry from the Razorpay dashboard');

    // A near-simultaneous duplicate request (double-click) can lose the race: the
    // sibling's refund already landed at the gateway, so it correctly rejects this one.
    // Reconcile from our own DB — always safe, regardless of the exact error wording.
    const fresh = await db.payment.findUnique({ where: { orderId } });
    const freshRefundId = isHdfc ? fresh?.hdfcRefundId : fresh?.razorpayRefundId;
    if (freshRefundId) return { order: await markOrderRefunded(freshRefundId) };

    logger.error({ err, orderId, orderNumber: order.orderNumber }, 'Refund failed after order cancellation');
    // Order status stays CANCELLED (never faked as REFUNDED), but the failure must survive
    // a page reload — a same-status log entry is how "refund pending/failed" shows up.
    await db.orderStatusLog.create({
      data: { orderId, from: 'CANCELLED', to: 'CANCELLED', note: `Refund failed: ${reason}`, createdBy: admin },
    });
    return { order, refundError: reason };
  }
}

// Delhivery-driven shipment status (webhook push or the tracking-sync fallback job)
// only ever touched Shipment.status before this — Order.status never moved off
// PAID/PROCESSING/PACKED even once a shipment was out for delivery or delivered,
// which is why admin dashboards undercounted delivered/in-transit orders.
// OUT_FOR_DELIVERY deliberately has no entry: Order.status has no distinct value for
// it, and the order is already SHIPPED by the time it happens (IN_TRANSIT always fires
// first) — the rank guard below would no-op it anyway. Keeping it out makes that
// explicit instead of relying on the guard.
const SHIPMENT_TO_ORDER_STATUS: Partial<Record<string, OrderStatus>> = {
  IN_TRANSIT: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  RETURNED: 'RETURN_REQUESTED',
};

const ORDER_STATUS_RANK: Record<OrderStatus, number> = {
  PENDING_PAYMENT: 0,
  PAID: 1,
  PROCESSING: 2,
  PACKED: 3,
  SHIPPED: 4,
  DELIVERED: 5,
  RETURN_REQUESTED: 6,
  REFUNDED: 7,
  CANCELLED: 8,
};

// FAILED shipment status has no mapping here on purpose — an NDR (failed delivery
// attempt) needs an admin decision (reattempt vs RTO) via takeOrderNdrAction, not an
// automatic order status flip.
export async function syncOrderStatusFromShipment(orderId: string, shipmentStatus: string): Promise<void> {
  const target = SHIPMENT_TO_ORDER_STATUS[shipmentStatus];
  if (!target) return;

  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return;
  // CANCELLED/REFUNDED are terminal and outrank everything by design — never let a late
  // or out-of-order tracking update resurrect a cancelled order. Anything else only
  // ever moves forward, so a re-delivered webhook replay or the 2-hourly sync job
  // re-polling an already-synced shipment is a no-op instead of a duplicate log entry.
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') return;
  if (ORDER_STATUS_RANK[target] <= ORDER_STATUS_RANK[order.status]) return;

  await db.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: target } });
    await tx.orderStatusLog.create({
      data: { orderId, from: order.status, to: target, note: 'Auto-updated from Delhivery tracking', createdBy: 'system:delhivery' },
    });
  });

  if (target === 'DELIVERED') void fetchFinalShippingCost(orderId);
}

// Best-effort: re-quotes Delhivery's rate calculator with this order's final declared
// weight once it's DELIVERED, as the closest automatic stand-in for what Delhivery
// actually billed (see finalShippingCost's schema comment — not a real invoice lookup,
// that API isn't available). Never throws into the caller — a failed re-quote just
// leaves finalShippingCost null, same as before delivery; it never blocks or reverts
// the DELIVERED status transition that triggered it.
async function fetchFinalShippingCost(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { variant: true } } },
    });
    if (!order || order.finalShippingCost !== null) return;

    const address = order.shippingAddress as unknown as { pincode: string };
    const weight =
      order.packageWeightOverride ?? order.items.reduce((sum, i) => sum + i.variant.weight * i.quantity, 0) + PACKAGING_WEIGHT_GRAMS;

    const result = await fetchDelhiveryShippingCost({
      originPincode: env.DELHIVERY_WAREHOUSE_PINCODE,
      destPincode: address.pincode,
      weightGrams: weight,
      paymentMode: 'Pre-paid',
    });
    if (!result) return;

    await db.order.update({ where: { id: orderId }, data: { finalShippingCost: result.amount } });
  } catch (err) {
    logger.error({ err, orderId }, 'Failed to fetch final Delhivery shipping cost');
  }
}

// Called when a Delhivery tracking remark reports a re-weigh with a parsed corrected
// weight (see webhooks/service.ts's detectWeightMismatch) — re-quotes the shipping cost
// with THAT weight instead of our own declared one, so the order's cost figure reflects
// what Delhivery is actually going to bill instead of silently staying at the
// (now-wrong) original quote. Still not their literal invoice (this re-quote is our own
// rate-calculator call, not a number Delhivery sent us directly) — closest available
// automatic correction, same caveat as fetchFinalShippingCost/quoteBookingShippingCost.
// Updates whichever cost field is "current" for this order: finalShippingCost once
// delivered, bookingShippingCost otherwise (mirrors the same priority the admin UI shows).
export async function applyWeightDiscrepancyCost(orderId: string, correctedWeightGrams: number): Promise<void> {
  try {
    const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, shippingAddress: true } });
    if (!order) return;

    const address = order.shippingAddress as unknown as { pincode: string };
    const result = await fetchDelhiveryShippingCost({
      originPincode: env.DELHIVERY_WAREHOUSE_PINCODE,
      destPincode: address.pincode,
      weightGrams: correctedWeightGrams,
      paymentMode: 'Pre-paid',
    });
    if (!result) return;

    const field = order.status === 'DELIVERED' ? 'finalShippingCost' : 'bookingShippingCost';
    await db.order.update({ where: { id: orderId }, data: { [field]: result.amount } });
  } catch (err) {
    logger.error({ err, orderId, correctedWeightGrams }, 'Failed to apply weight-discrepancy shipping cost correction');
  }
}
