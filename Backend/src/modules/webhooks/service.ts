import { db } from '../../shared/db/client';
import { logger } from '../../shared/logger/pino';
import { sendOrderConfirmation, sendShipmentNotification } from '../../shared/integrations/resend/client';
import { releaseCouponUsageTx } from '../coupons/service';
import { invalidateProductCaches } from '../products/service';
import { refundPayment } from '../../shared/integrations/razorpay/client';
import { syncOrderStatusFromShipment, applyWeightDiscrepancyCost, bookOrderShipment } from '../orders/service';

// Payment flip + order status flip (+ stock re-reserve on a late capture) all commit
// together. Previously the Payment row was marked CAPTURED first and the Order updated in a
// separate statement: a crash or DB blip between them left the payment CAPTURED but the order
// stuck PENDING_PAYMENT, and since the idempotency guard below keys on Payment.status, no
// retry (webhook redelivery, /checkout/verify, release-holds reconcile) would ever fix it.
//
// Idempotent, and covers a customer retry on the same Razorpay order after an earlier
// attempt failed: Razorpay lets multiple payment attempts hit one order_id, so a prior
// handlePaymentFailed can have already flipped this row to FAILED (and cancelled the
// order, releasing stock) before the retry's captured webhook arrives. The guard accepts
// PENDING|FAILED so that late capture still wins instead of silently no-op'ing. Replay-safe:
// once the row is CAPTURED a duplicate delivery of the same event finds status outside
// ('PENDING','FAILED') and no-ops.
export async function handlePaymentCaptured(razorpayOrderId: string, razorpayPaymentId: string): Promise<void> {
  const outcome = await db.$transaction(
    async (tx) => {
      const updated: number = await tx.$executeRaw`
        UPDATE "Payment" SET status = 'CAPTURED', "razorpayPaymentId" = ${razorpayPaymentId}, "verifiedAt" = NOW()
        WHERE "razorpayOrderId" = ${razorpayOrderId} AND status IN ('PENDING', 'FAILED')
      `;
      if (updated === 0) return null;

      const payment = await tx.payment.findUnique({
        where: { razorpayOrderId },
        include: { order: { include: { items: true } } },
      });
      if (!payment) return null;

      if (payment.order.status !== 'CANCELLED') {
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'PAID',
            statusLog: { create: { from: 'PENDING_PAYMENT', to: 'PAID', createdBy: 'system' } },
          },
        });
        return { kind: 'paid' as const, payment, restocked: false };
      }

      // The failed-attempt path already released this order's reserved stock back to the
      // pool — before honoring the late capture, re-reserve it for real, the same atomic
      // guard as checkout's reserveStock. Stock may genuinely be gone by now (sold out via
      // another order in the meantime); if so, do NOT mark this PAID over unavailable stock.
      const deducted: Array<{ variantId: string; quantity: number }> = [];
      for (const item of payment.order.items) {
        const rows: number = await tx.$executeRaw`
          UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" - ${item.quantity}
          WHERE id = ${item.variantId} AND "stockQuantity" >= ${item.quantity}
        `;
        if (rows === 0) {
          // Undo what this call already took; the Payment row stays CAPTURED (committed with
          // this transaction) so the money is accounted for and can be refunded.
          for (const d of deducted) {
            await tx.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${d.quantity} WHERE id = ${d.variantId}`;
          }
          return { kind: 'unfulfillable' as const, payment };
        }
        deducted.push({ variantId: item.variantId, quantity: item.quantity });
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
      return { kind: 'paid' as const, payment, restocked: true };
    },
    // Neon cold starts can eat seconds on the first query — Prisma's 5s default would close
    // the transaction mid-flight (see the same note on checkout's transaction).
    { maxWait: 5000, timeout: 15000 },
  );

  if (!outcome) return;

  if (outcome.kind === 'unfulfillable') {
    logger.error(
      { orderNumber: outcome.payment.order.orderNumber, razorpayPaymentId },
      'Payment captured on a retry after this order was cancelled, but stock is no longer available — refunding automatically',
    );
    await refundUnfulfillableCapture(outcome.payment, razorpayPaymentId);
    return;
  }

  const { payment } = outcome;
  if (outcome.restocked) await invalidateProductCaches();

  // Fire-and-forget — never block webhook response on email/shipment calls
  if (payment.order.customerEmail) {
    void sendOrderConfirmation(payment.order.customerEmail, payment.order.orderNumber, Number(payment.order.total));
  }
  // Carrier choice (Delhivery vs Ekart), weight and COD cash amount are all resolved
  // inside bookOrderShipment — same path as the manual admin retry.
  void bookOrderShipment(payment.orderId).then((booked) => {
    if (payment.order.customerEmail) {
      void sendShipmentNotification(payment.order.customerEmail, payment.order.orderNumber, booked.waybill);
    }
  }).catch((err) => {
    // A rejection (bad wallet balance, fraud check, bad address, Ekart not configured…)
    // or thrown error (network failure) would otherwise leave the order stuck with no
    // waybill and no trace of why. Admin can retry via the manual "Book Shipment" action
    // once the underlying issue is fixed.
    logger.error({ err, orderNumber: payment.order.orderNumber }, 'Auto-booking shipment failed');
  });
}

// Money was captured for an order we can't fulfil (cancelled, and its stock was sold in the
// meantime). Refund it instead of leaving the customer charged for nothing until an admin
// notices. A failed refund is logged on the order's status history so it survives a reload.
async function refundUnfulfillableCapture(
  payment: { id: string; orderId: string; amount: unknown },
  razorpayPaymentId: string,
): Promise<void> {
  try {
    const { refundId } = await refundPayment(razorpayPaymentId, Number(payment.amount));
    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED', razorpayRefundId: refundId, refundedAt: new Date() },
      });
      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          status: 'REFUNDED',
          statusLog: {
            create: { from: 'CANCELLED', to: 'REFUNDED', createdBy: 'system', note: `Payment captured after cancellation and stock was unavailable — auto-refunded (Razorpay refund ${refundId})` },
          },
        },
      });
    });
  } catch (err) {
    const reason = (err as { error?: { description?: string } } | null)?.error?.description ?? (err instanceof Error ? err.message : 'unknown error');
    logger.error({ err, orderId: payment.orderId, razorpayPaymentId }, 'Auto-refund of unfulfillable capture failed');
    await db.orderStatusLog
      .create({
        data: { orderId: payment.orderId, from: 'CANCELLED', to: 'CANCELLED', createdBy: 'system', note: `Payment captured but stock unavailable, auto-refund FAILED (${reason}) — refund ${razorpayPaymentId} manually on Razorpay` },
      })
      .catch(() => undefined);
  }
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

type ShipmentStatusId = ReturnType<typeof mapDelhiveryStatus>;

// Ekart's tracking statuses (spec: swift_status enum) -> our shipment status. Anything
// unlisted defaults to IN_TRANSIT, same convention as mapDelhiveryStatus.
export function mapEkartStatus(status: string, ndrStatus?: string): ShipmentStatusId {
  // An NDR status on an otherwise in-flight parcel means a failed delivery attempt that
  // needs an admin decision (reattempt vs RTO) - same FAILED state Delhivery's NDRs use.
  if (ndrStatus && !/^(Delivered|RTO)/.test(status)) return 'FAILED';
  const map: Record<string, ShipmentStatusId> = {
    'Order Placed': 'BOOKED',
    'Pickup Pending': 'BOOKED',
    'Pickup Scheduled': 'BOOKED',
    'Out for Pickup': 'BOOKED',
    'Not Picked': 'BOOKED',
    'Picked Up': 'IN_TRANSIT',
    'In Transit': 'IN_TRANSIT',
    'Shipment Delayed': 'IN_TRANSIT',
    'Out for Delivery': 'OUT_FOR_DELIVERY',
    Delivered: 'DELIVERED',
    Undelivered: 'FAILED',
    Cancelled: 'FAILED',
    'Seller Cancelled': 'FAILED',
    'Pickup Cancelled': 'FAILED',
    Lost: 'FAILED',
    Damaged: 'FAILED',
    'Not Serviceable': 'FAILED',
    'RTO Requested': 'RETURNED',
    'Seller RTO Requested': 'RETURNED',
    'RTO In Transit': 'RETURNED',
    'RTO Out for Delivery': 'RETURNED',
    'RTO Delivered': 'RETURNED',
    'RTO Failed': 'RETURNED',
    'RTO Shipment Delayed': 'RETURNED',
  };
  return map[status] ?? 'IN_TRANSIT';
}

// Shared by Ekart's track_updated webhook and the polling fallback (jobs/tracking-sync).
// Idempotent: an identical repeated event is skipped; order status only ever moves
// forward (see syncOrderStatusFromShipment).
export async function handleEkartStatusUpdate(
  trackingId: string,
  event: { status: string; location: string; description: string; timestamp: string; ndrStatus?: string },
): Promise<void> {
  const shipment = await db.shipment.findFirst({ where: { delhiveryWaybill: trackingId, carrier: 'EKART' } });
  if (!shipment) return;

  const events = (shipment.trackingEvents as unknown as Array<Record<string, string>>) ?? [];
  const last = events[events.length - 1];
  if (last && last.status === event.status && last.timestamp === event.timestamp) return;
  events.push({ status: event.status, location: event.location, description: event.description, timestamp: event.timestamp });

  const mapped = mapEkartStatus(event.status, event.ndrStatus);
  const risk = detectRiskFlag(`${event.ndrStatus ?? ''} ${event.description}`);

  await db.shipment.update({
    where: { id: shipment.id },
    data: {
      trackingEvents: events as unknown as object,
      status: mapped,
      ...(risk ? { riskFlag: risk.flag, riskReason: risk.reason } : {}),
    },
  });

  await syncOrderStatusFromShipment(shipment.orderId, mapped);
}
