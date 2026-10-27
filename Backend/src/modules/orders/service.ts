import { db } from '../../shared/db/client';
import { Prisma, type OrderStatus } from '@prisma/client';
import {
  createShipment,
  fetchShippingLabel,
  takeNdrAction,
  updateEwaybill,
  cancelDelhiveryShipment,
  calculateShippingCost as fetchDelhiveryShippingCost,
  type NdrAction,
} from '../../shared/integrations/delhivery/client';
import { fixLabelPdf, type LabelSize } from '../../shared/integrations/delhivery/labelPdf';
import { refundPayment } from '../../shared/integrations/razorpay/client';
import { logger } from '../../shared/logger/pino';
import { addItemToCart } from '../cart/service';
import { releaseCouponUsageTx } from '../coupons/service';
import { invalidateProductCaches } from '../products/service';
import { PACKAGING_WEIGHT_GRAMS } from '../../shared/constants/purposes';
import { chooseEkartAccount, providerName, type CarrierId, type ShipmentProvider } from '../../shared/shipping/carrier';
import { toEkartAccount, ekartConfig, type EkartAccount } from '../../shared/integrations/ekart/accounts';
import { checkEkartServiceability, estimateEkartCost } from '../../shared/integrations/ekart/client';
import {
  createEkartShipment,
  fetchEkartLabelPdf,
  takeEkartNdrAction,
  updateEkartEwaybill,
  cancelEkartShipment,
} from '../../shared/integrations/ekart/client';
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
export async function resumeOrder(publicToken: string, sessionId: string): Promise<{ addedCount: number; skippedCount: number }> {
  const order = await db.order.findUnique({ where: { publicToken }, include: { items: true } });
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

// Label / NDR / e-way bill go to whichever carrier owns the waybill — sending one
// carrier's id to the other's API would fail or hit the wrong parcel.
async function getShipmentOrThrow(orderId: string): Promise<{ waybill: string; carrier: CarrierId; ekartAccount: EkartAccount }> {
  const shipment = await db.shipment.findUnique({ where: { orderId } });
  if (!shipment?.delhiveryWaybill) throw new NoWaybillError();
  return { waybill: shipment.delhiveryWaybill, carrier: shipment.carrier, ekartAccount: toEkartAccount(shipment.ekartAccount) };
}

type BookableAddress = { line1: string; line2?: string; city: string; state: string; pincode: string };

const REBOOK_NOTE = 'cancelled to switch provider';

// Cancels a booked parcel at whichever carrier owns the waybill. Never throws.
export async function cancelCarrierShipment(shipment: {
  carrier: CarrierId;
  delhiveryWaybill: string | null;
  ekartAccount: number | null;
}): Promise<{ success: boolean; error?: string }> {
  if (!shipment.delhiveryWaybill) return { success: false, error: 'No waybill to cancel' };
  try {
    return shipment.carrier === 'EKART'
      ? await cancelEkartShipment(toEkartAccount(shipment.ekartAccount), shipment.delhiveryWaybill)
      : await cancelDelhiveryShipment(shipment.delhiveryWaybill);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Cancel request failed' };
  }
}

export interface BookedShipment {
  waybill: string;
  carrier: CarrierId;
  /** 1 = prepaid, 2 = COD; null for Delhivery. */
  ekartAccount: EkartAccount | null;
}

// Books the parcel. `target` AUTO (default, used by the automatic booking on payment and by the
// Admin "Book" button): prepaid -> Ekart 1, COD -> Ekart 2, and Delhivery ONLY when Ekart says
// the pincode (or COD) isn't serviceable; wallet/auth/network failures throw and wait for a retry.
// An explicit target (EKART_1 / EKART_2 / DELHIVERY, chosen by an admin) books exactly there and
// never falls back - the admin decided, so a failure is reported, not silently re-routed.
// Refuses if a shipment already exists - never books twice.
export async function bookOrderShipment(orderId: string, target: ShipmentProvider = 'AUTO'): Promise<BookedShipment> {
  const existing = await db.shipment.findUnique({ where: { orderId } });
  if (existing?.delhiveryWaybill) throw new Error('This order already has a shipment booked.');

  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { include: { variant: true } } } });
  if (!order) throw new Error('Order not found');

  // Declared weight must match the real packed parcel (all items + packaging go into
  // ONE box on ONE waybill) - under-declaring risks the carrier re-weighing and billing
  // the difference. See PACKAGING_WEIGHT_GRAMS's comment. An admin-set
  // packageWeightOverride (see updateOrderPackageWeight) always wins - it means someone
  // actually weighed this specific box and knows better than the item-sum estimate.
  const weight =
    order.packageWeightOverride ??
    order.items.reduce((sum, i) => sum + i.variant.weight * i.quantity, 0) + PACKAGING_WEIGHT_GRAMS;
  const address = order.shippingAddress as unknown as BookableAddress;
  const forced = target !== 'AUTO';
  const ekartAccount: EkartAccount = target === 'EKART_1' ? 1 : target === 'EKART_2' ? 2 : chooseEkartAccount(order.paymentMethod);

  // A switched-provider rebooking uses a suffixed reference (DOSH-...-R1): carriers can reject a
  // reference they've already seen, even for a cancelled waybill.
  const switches = await db.orderStatusLog.count({ where: { orderId, note: { contains: REBOOK_NOTE } } });
  const orderRef = switches > 0 ? `${order.orderNumber}-R${switches}` : order.orderNumber;

  const codAmount = Number(order.codAmountDue);
  const productsDesc = order.items
    .map((i) => (i.variantSnapshot as { productName?: string } | null)?.productName ?? i.variant.sku)
    .join(', ');
  const quantity = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const invoiceDate = order.createdAt.toISOString().slice(0, 10);

  // Never throw - a network failure becomes { error } so it can be reported / classified.
  const ekartAttempt = async () => {
    try {
      return await createEkartShipment(ekartAccount, {
        orderNumber: orderRef,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address,
        weight,
        codAmount,
        orderTotal: Number(order.total),
        taxValue: Math.round(computeOrderGst(order.items).gstAmount * 100) / 100,
        productsDesc,
        quantity,
        invoiceDate,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Ekart request failed', unserviceable: false };
    }
  };
  const delhiveryAttempt = async (): Promise<{ waybill: string } | { error: string } | null> => {
    try {
      return await createShipment({
        orderNumber: orderRef,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address,
        weight,
        // COD must keep collecting cash whenever it lands on Delhivery.
        cod: codAmount > 0 ? { codAmount, orderTotal: Number(order.total), productsDesc, quantity, invoiceDate } : undefined,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Delhivery request failed' };
    }
  };

  let carrier: CarrierId = 'EKART';
  let result: { waybill: string };
  let fallbackReason: string | null = null;

  if (target === 'DELHIVERY') {
    const d = await delhiveryAttempt();
    if (!d || 'error' in d) throw new Error(`Delhivery: ${!d ? 'not configured' : d.error}`);
    carrier = 'DELHIVERY';
    result = d;
  } else {
    // Ask Ekart up front whether it can deliver here (and take cash, for COD): a definite "no" never
    // wastes a doomed booking call. An unknown answer (null) just tries the booking, whose own error
    // text is then classified.
    const svc = await checkEkartServiceability(ekartAccount, address.pincode);
    const ekart =
      svc && (!svc.serviceable || (codAmount > 0 && !svc.codAllowed))
        ? { error: svc.serviceable ? 'COD is not available at this pincode' : svc.remark, unserviceable: true }
        : await ekartAttempt();
    if (ekart && !('error' in ekart)) {
      result = ekart;
    } else if (ekart && ekart.unserviceable && !forced) {
      // Ekart cannot reach this pincode - the only failure that falls back to Delhivery.
      const delhivery = await delhiveryAttempt();
      if (!delhivery || 'error' in delhivery) {
        throw new Error(`${providerName('EKART', ekartAccount)}: ${ekart.error} | Delhivery: ${!delhivery ? 'not configured' : delhivery.error}`);
      }
      logger.warn({ orderId, ekartAccount, reason: ekart.error }, 'Ekart pincode not serviceable - booked on Delhivery');
      carrier = 'DELHIVERY';
      fallbackReason = `Ekart account ${ekartAccount}: ${ekart.error}`;
      result = delhivery;
    } else {
      // Wallet empty, bad credentials, Ekart down, bad address etc. wait for a retry; an explicit
      // admin choice is never silently re-routed either.
      throw new Error(
        `${providerName('EKART', ekartAccount)}: ${ekart ? ekart.error : 'not configured'} (${forced ? 'no fallback - you chose this provider' : 'no fallback - retry later'})`
      );
    }
  }

  const shipmentData = {
    delhiveryWaybill: result.waybill,
    carrier,
    ekartAccount: carrier === 'EKART' ? ekartAccount : null,
    bookedVia: carrier === 'EKART' ? ekartConfig(ekartAccount).username || null : env.DELHIVERY_CLIENT_NAME,
    fallbackReason,
    status: 'BOOKED' as const,
  };
  if (existing) {
    await db.shipment.update({ where: { orderId }, data: shipmentData });
  } else {
    await db.shipment.create({ data: { orderId, ...shipmentData } });
  }

  await recordBookingCost(orderId, {
    carrier,
    ekartAccount,
    weight,
    destPincode: address.pincode,
    codAmount,
    orderTotal: Number(order.total),
  });

  return { waybill: result.waybill, carrier, ekartAccount: carrier === 'EKART' ? ekartAccount : null };
}

// Called when an order is cancelled: cancel the booked parcel too (Ekart 1/2 or Delhivery) so it is never
// picked up and shipped. Best-effort - a failed carrier cancel is written to the order's history for the
// admin but never blocks the refund. A parcel already with the courier can't be cancelled (that needs an
// RTO) and the note says so. Never throws.
export async function cancelShipmentForCancelledOrder(orderId: string, admin: string): Promise<void> {
  try {
    const shipment = await db.shipment.findUnique({ where: { orderId } });
    if (!shipment?.delhiveryWaybill) return;
    const name = providerName(shipment.carrier, shipment.ekartAccount);
    const waybill = shipment.delhiveryWaybill;
    const note = (text: string) => db.orderStatusLog.create({ data: { orderId, from: 'CANCELLED', to: 'CANCELLED', note: text, createdBy: admin } });

    if (shipment.status === 'BOOKED') {
      const cancelled = await cancelCarrierShipment(shipment);
      if (!cancelled.success) {
        logger.error({ orderId, waybill, reason: cancelled.error }, `Could not cancel ${name} shipment on order cancel`);
        await note(`${name} shipment NOT cancelled: ${cancelled.error ?? 'unknown'} - cancel ${waybill} on the carrier dashboard`);
      } else {
        await db.shipment.update({ where: { orderId }, data: { status: 'FAILED' } });
        await note(`${name} shipment ${waybill} cancelled`);
      }
    } else if (!['FAILED', 'RETURNED', 'DELIVERED'].includes(shipment.status)) {
      await note(`${name} parcel ${waybill} is already ${shipment.status} and could not be cancelled - arrange an RTO`);
    }
  } catch (err) {
    logger.error({ err, orderId }, 'Shipment cancellation on order cancel crashed');
  }
}

const SWITCHABLE_ORDER_STATUSES = new Set(['PAID', 'PROCESSING', 'PACKED', 'SHIPPED']);

// null = Ekart can take this parcel; otherwise the reason it can't (or that it couldn't be confirmed).
async function ekartPreflight(account: EkartAccount, pincode: string, codAmount: number): Promise<string | null> {
  const name = providerName('EKART', account);
  const svc = await checkEkartServiceability(account, pincode);
  if (!svc) return `Could not confirm that ${name} delivers to ${pincode} right now.`;
  if (!svc.serviceable) return `${name} does not deliver to ${pincode}.`;
  if (codAmount > 0 && !svc.codAllowed) return `${name} does not offer cash on delivery at ${pincode}.`;
  return null;
}

// Moves an order to a different provider: cancels the existing waybill at its carrier FIRST (if that
// fails nothing changes), clears the old shipment record, then books the new one. If the new booking
// fails the old parcel is already cancelled - the error says so and the order shows "not booked" so
// the admin can book again. Only possible before pickup (shipment still BOOKED).
export async function rebookOrderShipment(orderId: string, target: ShipmentProvider, admin: string): Promise<BookedShipment> {
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, shippingAddress: true, codAmountDue: true } });
  if (!order) throw new Error('Order not found');
  if (!SWITCHABLE_ORDER_STATUSES.has(order.status)) throw new Error(`Cannot switch the provider of a ${order.status} order`);

  const shipment = await db.shipment.findUnique({ where: { orderId } });
  if (!shipment?.delhiveryWaybill) return bookOrderShipment(orderId, target); // nothing to cancel
  if (shipment.status !== 'BOOKED') {
    throw new Error(`The parcel is already ${shipment.status.toLowerCase().replace(/_/g, ' ')} - it can no longer be switched. Use the NDR / RTO actions instead.`);
  }

  // Never cancel a working booking for a target that can't take the parcel: confirm Ekart serves the
  // pincode (and takes cash, for COD) first. If that can't be confirmed, change nothing.
  if (target === 'EKART_1' || target === 'EKART_2') {
    const blocker = await ekartPreflight(target === 'EKART_1' ? 1 : 2, (order.shippingAddress as unknown as BookableAddress).pincode, Number(order.codAmountDue));
    if (blocker) throw new Error(`${blocker} Nothing was changed.`);
  }

  const from = providerName(shipment.carrier, shipment.ekartAccount);
  const oldWaybill = shipment.delhiveryWaybill;
  const cancelled = await cancelCarrierShipment(shipment);
  if (!cancelled.success) {
    throw new Error(`Could not cancel the existing ${from} shipment (${cancelled.error ?? 'unknown error'}). Nothing was changed.`);
  }

  await db.shipment.update({
    where: { orderId },
    data: { delhiveryWaybill: null, status: 'PENDING', ekartAccount: null, bookedVia: null, fallbackReason: null, costPreTax: null, costTax: null },
  });
  await db.order.update({ where: { id: orderId }, data: { bookingShippingCost: null } });
  await db.orderStatusLog.create({
    data: { orderId, from: order.status, to: order.status, note: `Shipment ${oldWaybill} (${from}) ${REBOOK_NOTE}`, createdBy: admin },
  });

  try {
    const booked = await bookOrderShipment(orderId, target);
    await db.orderStatusLog.create({
      data: {
        orderId,
        from: order.status,
        to: order.status,
        note: `Re-booked on ${providerName(booked.carrier, booked.ekartAccount)}: waybill ${booked.waybill}`,
        createdBy: admin,
      },
    });
    return booked;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'booking failed';
    await db.orderStatusLog
      .create({ data: { orderId, from: order.status, to: order.status, note: `New booking after switch failed: ${reason}`, createdBy: admin } })
      .catch(() => undefined);
    throw new Error(`The old ${from} shipment was cancelled, but the new booking failed: ${reason}. Book again from this page.`);
  }
}

// Best-effort: quotes what the carrier that actually took the parcel charges for it, the
// moment it is booked - Ekart's own rate API for the booked account (GST split included), or
// Delhivery's rate calculator for a fallback parcel. Uses the exact weight sent in the booking
// call, so it reflects a packageWeightOverride (unlike actualShippingCost, frozen at checkout).
// It is a rate quote, not a carrier invoice. Never throws into the caller: a failed quote just
// leaves bookingShippingCost null; it never blocks or undoes the booking.
async function recordBookingCost(
  orderId: string,
  p: { carrier: CarrierId; ekartAccount: EkartAccount; weight: number; destPincode: string; codAmount: number; orderTotal: number },
): Promise<void> {
  try {
    const originPincode = env.DELHIVERY_WAREHOUSE_PINCODE;
    let total: number | null = null;
    let tax: number | null = null;
    if (p.carrier === 'EKART') {
      const q = await estimateEkartCost(p.ekartAccount, {
        originPincode,
        destPincode: p.destPincode,
        weight: p.weight,
        codAmount: p.codAmount,
        invoiceAmount: p.orderTotal,
      });
      if (q) {
        total = q.total;
        tax = q.tax;
      }
    } else {
      const q = await fetchDelhiveryShippingCost({
        originPincode,
        destPincode: p.destPincode,
        weightGrams: p.weight,
        paymentMode: p.codAmount > 0 ? 'COD' : 'Pre-paid',
      });
      if (q) {
        total = q.amount;
        tax = q.tax;
      }
    }
    if (total === null) return;
    await db.order.update({ where: { id: orderId }, data: { bookingShippingCost: total } });
    await db.shipment.update({
      where: { orderId },
      data: { costTax: tax, costPreTax: tax === null ? null : Math.round((total - tax) * 100) / 100 },
    });
  } catch (err) {
    logger.error({ err, orderId }, 'Failed to record booking-time shipping cost');
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
  const { waybill, carrier, ekartAccount } = await getShipmentOrThrow(orderId);
  if (carrier === 'EKART') {
    // Ekart's PDF is already print-ready; the size picker only applies to Delhivery's.
    const pdf = await fetchEkartLabelPdf(ekartAccount, waybill);
    if ('error' in pdf) throw new Error(pdf.error);
    return { pdfBase64: pdf.toString('base64') };
  }
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
  const { waybill, carrier, ekartAccount } = await getShipmentOrThrow(orderId);
  const result =
    carrier === 'EKART'
      ? await takeEkartNdrAction(ekartAccount, {
          trackingId: waybill,
          action: params.action === 'RTO' ? 'RTO' : 'Re-Attempt',
          reattemptDate: params.reattemptDate,
          instructions: params.comment,
        })
      : await takeNdrAction({ waybill, ...params });
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
  const { waybill, carrier, ekartAccount } = await getShipmentOrThrow(orderId);
  const result =
    carrier === 'EKART' ? await updateEkartEwaybill(ekartAccount, waybill, ewaybillNumber) : await updateEwaybill({ waybill, ewaybillNumber });
  if (!result.success) throw new Error(result.error ?? 'E-way bill update failed');

  await db.shipment.update({ where: { orderId }, data: { ewaybillNumber } });
}

// Order/product images so the storefront's order pages can show real thumbnails
// (Amazon/Flipkart-style) instead of a generic icon per line item.
const itemsWithProductImage = { items: { include: { variant: { include: { product: true } } } } } as const;

// Public order reads are keyed by the unguessable publicToken, never the sequential orderNumber.
export async function getOrderByPublicToken(publicToken: string) {
  return db.order.findUnique({
    where: { publicToken },
    include: { ...itemsWithProductImage, payment: true, shipment: true },
  });
}

// "Find my order": the orderNumber alone is enumerable, so it only yields the slug when paired with
// the phone number on the order. Returns null for both "no such order" and "wrong phone" so the
// caller can't tell which one failed.
export async function lookupOrderPublicToken(orderNumber: string, phone: string): Promise<string | null> {
  const order = await db.order.findUnique({ where: { orderNumber }, select: { publicToken: true, customerPhone: true } });
  if (!order || order.customerPhone !== phone) return null;
  return order.publicToken;
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

export async function listOrdersForAdmin(query: {
  status?: OrderStatus;
  from?: string;
  to?: string;
  q?: string;
  paymentMethod?: 'PREPAID' | 'COD';
  page: number;
  limit: number;
}) {
  const where: Prisma.OrderWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
  const q = query.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, '');
    const phoneLike = digits.length >= 3 && /^[\d\s+()-]+$/.test(q);
    const ci = { contains: q, mode: 'insensitive' as const };
    where.AND = [
      {
        OR: [
          { orderNumber: ci },
          { customerName: ci },
          { customerPhone: { contains: phoneLike ? digits : q } },
          { customerEmail: ci },
          { shipment: { is: { delhiveryWaybill: ci } } },
        ],
      },
    ];
  }
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

  await cancelShipmentForCancelledOrder(orderId, admin);

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
export async function syncOrderStatusFromShipment(orderId: string, shipmentStatus: string, source: 'delhivery' | 'ekart' = 'delhivery'): Promise<void> {
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
      data: {
        orderId,
        from: order.status,
        to: target,
        note: `Auto-updated from ${source === 'ekart' ? 'Ekart' : 'Delhivery'} tracking`,
        createdBy: `system:${source}`,
      },
    });
  });

  // The re-quote below is Delhivery's rate calculator - meaningless for an Ekart parcel.
  if (target === 'DELIVERED' && source === 'delhivery') void fetchFinalShippingCost(orderId);
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

export interface BulkSwitchResult {
  dryRun: boolean;
  /** Delhivery parcels that are booked but not yet picked up. */
  eligible: number;
  switched: number;
  /** Left on Delhivery on purpose (Ekart can't serve the pincode / couldn't be checked). */
  skipped: Array<{ orderNumber: string; reason: string }>;
  failed: Array<{ orderNumber: string; error: string }>;
  /** Eligible parcels not touched in this batch (batch limit) - run again. */
  remaining: number;
}

// Moves parcels that are booked on Delhivery but not yet picked up over to Ekart: prepaid -> Ekart 1,
// COD -> Ekart 2. Each one goes through rebookOrderShipment (pre-check, cancel, re-book, audit note),
// one at a time and in bounded batches. dryRun only reports what would happen.
export async function switchDelhiveryBookingsToEkart(opts: { dryRun: boolean; limit: number; admin: string }): Promise<BulkSwitchResult> {
  const rows = await db.shipment.findMany({
    where: {
      carrier: 'DELHIVERY',
      status: 'BOOKED',
      delhiveryWaybill: { not: null },
      // SHIPPED is excluded: the courier may already hold the parcel even if tracking hasn't caught up.
      order: { status: { in: ['PAID', 'PROCESSING', 'PACKED'] } },
    },
    select: { order: { select: { id: true, orderNumber: true, paymentMethod: true, shippingAddress: true, codAmountDue: true } } },
    orderBy: { order: { createdAt: 'asc' } },
  });

  const result: BulkSwitchResult = { dryRun: opts.dryRun, eligible: rows.length, switched: 0, skipped: [], failed: [], remaining: 0 };
  let touched = 0;
  for (const { order } of rows) {
    const account: EkartAccount = order.paymentMethod === 'COD' ? 2 : 1;
    const blocker = await ekartPreflight(account, (order.shippingAddress as unknown as BookableAddress).pincode, Number(order.codAmountDue));
    if (blocker) {
      result.skipped.push({ orderNumber: order.orderNumber, reason: blocker });
      continue;
    }
    if (opts.dryRun) {
      result.switched++; // "would switch"
      continue;
    }
    if (touched >= opts.limit) {
      result.remaining++;
      continue;
    }
    touched++;
    try {
      await rebookOrderShipment(order.id, account === 1 ? 'EKART_1' : 'EKART_2', opts.admin);
      result.switched++;
    } catch (err) {
      result.failed.push({ orderNumber: order.orderNumber, error: err instanceof Error ? err.message : 'failed' });
    }
  }
  return result;
}
