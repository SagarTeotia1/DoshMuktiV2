import { db } from '../../shared/db/client';
import { logger } from '../../shared/logger/pino';
import { sendOrderConfirmation, sendShipmentNotification } from '../../shared/integrations/resend/client';
import { createShipment } from '../../shared/integrations/delhivery/client';
import { releaseCouponUsageTx } from '../coupons/service';
import { invalidateProductCaches } from '../products/service';
import { syncOrderStatusFromShipment, quoteBookingShippingCost, applyWeightDiscrepancyCost } from '../orders/service';
import { PACKAGING_WEIGHT_GRAMS } from '../../shared/constants/purposes';

interface RazorpayShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export async function handlePaymentCaptured(razorpayOrderId: string, razorpayPaymentId: string): Promise<void> {
  // Idempotent, and covers a customer retry on the same Razorpay order after an earlier
  // attempt failed: Razorpay lets multiple payment attempts hit one order_id, so a prior
  // handlePaymentFailed can have already flipped this row to FAILED (and cancelled the
  // order, releasing stock) before the retry's captured webhook arrives. Widening the
  // guard to PENDING|FAILED lets that late capture still win instead of silently
  // no-op'ing — money captured with no matching live order was exactly that bug.
  // Still replay-safe: once this flips the row to CAPTURED, a duplicate delivery of the
  // same event finds status outside ('PENDING','FAILED') and no-ops as before.
  const updated: number = await db.$executeRaw`
    UPDATE "Payment" SET status = 'CAPTURED', "razorpayPaymentId" = ${razorpayPaymentId}, "verifiedAt" = NOW()
    WHERE "razorpayOrderId" = ${razorpayOrderId} AND status IN ('PENDING', 'FAILED')
  `;
  if (updated === 0) return;

  const payment = await db.payment.findUnique({
    where: { razorpayOrderId },
    include: { order: { include: { items: { include: { variant: true } } } } },
  });
  if (!payment) return;

  if (payment.order.status === 'CANCELLED') {
    // The failed-attempt path already released this order's reserved stock back to the
    // pool — before honoring the late capture, re-reserve it for real, the same atomic
    // guard as checkout's reserveStock. Stock may genuinely be gone by now (sold out via
    // another order in the meantime); if so, do NOT silently mark this PAID over
    // unavailable stock — leave it CANCELLED with payment now correctly CAPTURED, log
    // loudly, and let an admin resolve (refund or manual restock) via Admin's order page.
    const outOfStock = await db.$transaction(async (tx) => {
      for (const item of payment.order.items) {
        const rows: number = await tx.$executeRaw`
          UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - ${item.quantity}
          WHERE id = ${item.variantId} AND "stockQuantity" >= ${item.quantity}
        `;
        if (rows === 0) return true; // Serializable tx: rolls back any deductions already made this call
      }

      for (const item of payment.order.items) {
        await tx.stockMovement.create({
          data: { variantId: item.variantId, change: -item.quantity, reason: 'SALE', orderId: payment.orderId, createdBy: 'system' },
        });
      }

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'PAID',
          statusLog: { create: { from: 'CANCELLED', to: 'PAID', createdBy: 'system', note: `Late capture on retried payment: ${razorpayPaymentId}` } },
        },
      });
      return false;
    }, { isolationLevel: 'Serializable' });

    if (outOfStock) {
      logger.error(
        { orderNumber: payment.order.orderNumber, razorpayPaymentId },
        'Payment captured on a retry after this order was cancelled, but stock is no longer available — payment marked CAPTURED, order left CANCELLED for manual admin resolution',
      );
      return;
    }
    await invalidateProductCaches();
  } else {
    await db.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'PAID',
        statusLog: { create: { from: 'PENDING_PAYMENT', to: 'PAID', createdBy: 'system' } },
      },
    });
  }

  // Fire-and-forget — never block webhook response on email/shipment calls
  if (payment.order.customerEmail) {
    void sendOrderConfirmation(payment.order.customerEmail, payment.order.orderNumber, Number(payment.order.total));
  }
  const addr = payment.order.shippingAddress as unknown as RazorpayShippingAddress;
  // See PACKAGING_WEIGHT_GRAMS's comment — declared weight must match the real packed
  // parcel (all items + packaging in ONE box on ONE waybill), same as bookOrderShipment.
  // An admin-set packageWeightOverride wins if present, same rule as the manual retry path.
  const bookingWeight =
    payment.order.packageWeightOverride ??
    payment.order.items.reduce((sum, i) => sum + i.variant.weight * i.quantity, 0) + PACKAGING_WEIGHT_GRAMS;
  void createShipment({
    orderNumber: payment.order.orderNumber,
    customerName: payment.order.customerName,
    customerPhone: payment.order.customerPhone,
    address: addr,
    weight: bookingWeight,
  }).then(async (shipment) => {
    if (shipment && 'waybill' in shipment) {
      await db.shipment.create({ data: { orderId: payment.orderId, delhiveryWaybill: shipment.waybill, status: 'BOOKED' } });
      void quoteBookingShippingCost(payment.orderId, bookingWeight, addr.pincode);
      if (payment.order.customerEmail) {
        void sendShipmentNotification(payment.order.customerEmail, payment.order.orderNumber, shipment.waybill);
      }
    } else {
      // createShipment returns an error (or null in dev with no API key) on a
      // Delhivery-side rejection (bad wallet balance, fraud check, bad address, etc)
      // rather than throwing — without this log the order is just stuck with no waybill
      // and nothing ever says why. Admin can retry via the manual "Book Shipment" action
      // once the underlying issue is fixed.
      logger.error(
        { orderNumber: payment.order.orderNumber, reason: shipment?.error ?? 'no API key configured' },
        'createShipment did not return a waybill — Delhivery rejected the shipment',
      );
    }
  }).catch((err) => {
    // A thrown error here (network failure, etc) would otherwise be an unhandled
    // rejection — silently dropped, order stuck with no waybill and no trace of why.
    logger.error({ err, orderNumber: payment.order.orderNumber }, 'createShipment threw while booking shipment');
  });
}

// A payment.failed webhook means this order is definitively dead — not just
// "not yet paid" like a still-in-progress checkout. Previously this only flipped
// Payment to FAILED and left the Order sitting in PENDING_PAYMENT indefinitely
// (reserved stock held, coupon slot held), relying on the release-holds cron to
// eventually notice once reservedUntil passed — so a real failure looked
// indistinguishable from a live in-progress order in Admin for up to
// RESERVATION_MINUTES. Now it releases the reservation immediately, same
// atomic/append-only rules as release-holds.ts.
export async function handlePaymentFailed(razorpayOrderId: string, reason: string): Promise<void> {
  const updated: number = await db.$executeRaw`
    UPDATE "Payment" SET status = 'FAILED', "failureReason" = ${reason}
    WHERE "razorpayOrderId" = ${razorpayOrderId} AND status = 'PENDING'
  `;
  if (updated === 0) return; // already processed

  const payment = await db.payment.findUnique({
    where: { razorpayOrderId },
    include: { order: { include: { items: true } } },
  });
  if (!payment) return;

  const order = payment.order;

  await db.$transaction(async (tx) => {
    // Idempotent: only an order still PENDING_PAYMENT gets cancelled/released —
    // guards against a replayed webhook or a race with the release-holds sweep
    // double-releasing the same stock.
    const cancelled: number = await tx.$executeRaw`
      UPDATE "Order" SET status = 'CANCELLED', "updatedAt" = NOW()
      WHERE id = ${order.id} AND status = 'PENDING_PAYMENT'
    `;
    if (cancelled === 0) return;

    for (const item of order.items) {
      await tx.$executeRaw`
        UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${item.quantity} WHERE id = ${item.variantId}
      `;
      await tx.stockMovement.create({
        data: { variantId: item.variantId, change: item.quantity, reason: 'RESERVATION_RELEASED', orderId: order.id, createdBy: 'system' },
      });
    }

    if (order.couponId) {
      await releaseCouponUsageTx(tx, order.couponId);
    }

    await tx.orderStatusLog.create({
      data: { orderId: order.id, from: 'PENDING_PAYMENT', to: 'CANCELLED', createdBy: 'system', note: `Payment failed: ${reason}` },
    });
  });

  await invalidateProductCaches();
}

export async function handleDelhiveryStatusUpdate(waybill: string, event: { status: string; location: string; description: string; timestamp: string }): Promise<void> {
  const shipment = await db.shipment.findFirst({ where: { delhiveryWaybill: waybill } });
  if (!shipment) return;

  const events = (shipment.trackingEvents as unknown as Array<typeof event>) ?? [];
  events.push(event);

  const risk = detectRiskFlag(event.description);
  const weightMismatch = detectWeightMismatch(event.description);

  const mappedStatus = mapDelhiveryStatus(event.status);

  await db.shipment.update({
    where: { id: shipment.id },
    data: {
      trackingEvents: events as unknown as object,
      status: mappedStatus,
      // Only ever set here, never cleared — an NDR remark once seen stays true until an
      // admin resolves it via an NDR action (see takeOrderNdrAction, which clears it).
      ...(risk ? { riskFlag: risk.flag, riskReason: risk.reason } : {}),
      // Overwritten (not accumulated) on every new mismatch remark — the latest one is
      // the relevant one, and the raw description is preserved in trackingEvents anyway.
      ...(weightMismatch ? { weightDiscrepancyNote: weightMismatch.note } : {}),
    },
  });

  await syncOrderStatusFromShipment(shipment.orderId, mappedStatus);

  // Best-effort: if the remark gave us Delhivery's corrected weight, re-quote the
  // shipping cost with it so the order's displayed cost reflects the higher (or lower)
  // real charge instead of silently staying wrong. If no weight could be parsed out of
  // the free-text remark, the note alone still shows on the order for admin to check
  // manually — see applyWeightDiscrepancyCost's own comment for why this can't be exact.
  if (weightMismatch?.correctedWeightGrams) {
    void applyWeightDiscrepancyCost(shipment.orderId, weightMismatch.correctedWeightGrams);
  }
}

// Delhivery's NDR remarks are free text, not a coded reason field — this is a best-effort
// keyword match against the phrases actually seen on this account's failed deliveries.
function detectRiskFlag(description: string): { flag: 'BAD_ADDRESS' | 'HIGH_RISK'; reason: string } | null {
  const text = description.toLowerCase();
  if (/address|pin ?code|location not found|unserviceable/.test(text)) {
    return { flag: 'BAD_ADDRESS', reason: description };
  }
  if (/fraud|fake order|refused|not reachable|phone.*(off|invalid)|door lock/.test(text)) {
    return { flag: 'HIGH_RISK', reason: description };
  }
  return null;
}

// Same best-effort keyword match as detectRiskFlag, for Delhivery's re-weigh / declared-
// vs-actual weight discrepancy remarks. Also tries to pull the corrected weight out of
// the free text (formats like "actual weight 850gm" / "actual wt: 0.85 kg") — this
// format is NOT confirmed against real Delhivery remarks (same caveat as the rest of
// this file's best-effort parsing), so a failed extraction is expected and handled: the
// note still gets shown, just without an automatic cost update.
function detectWeightMismatch(description: string): { note: string; correctedWeightGrams?: number } | null {
  const text = description.toLowerCase();
  if (!/weight discrepancy|weight mismatch|re-?weigh(ed)?|weight dispute/.test(text)) return null;

  const match = /actual\s*(?:weight|wt)?\s*[:\-]?\s*([\d.]+)\s*(kgs?|gms?|g)\b/i.exec(description);
  const rawValue = match?.[1];
  const rawUnit = match?.[2];
  if (!rawValue || !rawUnit) return { note: description };

  const value = parseFloat(rawValue);
  if (!Number.isFinite(value) || value <= 0) return { note: description };
  const unit = rawUnit.toLowerCase();
  const grams = unit.startsWith('kg') ? Math.round(value * 1000) : Math.round(value);

  return { note: description, correctedWeightGrams: grams };
}

export function mapDelhiveryStatus(status: string): 'PENDING' | 'BOOKED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED' {
  const map: Record<string, ReturnType<typeof mapDelhiveryStatus>> = {
    Manifested: 'BOOKED',
    'In Transit': 'IN_TRANSIT',
    'Out for Delivery': 'OUT_FOR_DELIVERY',
    Delivered: 'DELIVERED',
    Undelivered: 'FAILED',
    RTO: 'RETURNED',
  };
  return map[status] ?? 'IN_TRANSIT';
}
