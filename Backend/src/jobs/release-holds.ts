import { db } from '../shared/db/client';
import { invalidateProductCaches } from '../modules/products/service';
import { cancelPendingOrderTx } from '../modules/orders/service';
import { handlePaymentCaptured } from '../modules/webhooks/service';
import { findCapturedPayment } from '../shared/integrations/razorpay/client';
import { logger } from '../shared/logger/pino';

// Sweeps orders stuck in PENDING_PAYMENT past their reservation window and releases the
// reserved stock back to inventory. Hit by Cloud Scheduler.
//
// Before cancelling any of them, asks Razorpay directly whether the payment actually
// captured — our own /api/checkout/verify (client-driven, fires right after payment) and
// the Razorpay webhook are both supposed to reconcile this already, but both can silently
// miss an order (network blip, webhook not configured for this deployment, etc). Without
// this check, a genuinely-paid order whose confirmation got lost would get auto-cancelled
// and its stock released back — the customer's money gone, no order to show for it.
// reconcileWithRazorpay reuses handlePaymentCaptured (same idempotent path the webhook
// and verify endpoint both use), so a reconciled order ends up in exactly the same state
// either path would have left it in.
async function reconcileWithRazorpay(orderId: string, razorpayOrderId: string): Promise<boolean> {
  try {
    const captured = await findCapturedPayment(razorpayOrderId);
    if (!captured) return false;
    await handlePaymentCaptured(razorpayOrderId, captured.razorpayPaymentId);
    logger.warn({ orderId, razorpayOrderId }, 'release-holds: found a captured payment Razorpay had that we missed — reconciled instead of cancelling');
    return true;
  } catch (err) {
    // Can't confirm either way — do NOT cancel on an unconfirmed check. Better to leave
    // it pending past its window for the next run to retry than to risk cancelling a
    // paid order because Razorpay's API itself was unreachable this one time.
    logger.error({ err, orderId, razorpayOrderId }, 'release-holds: Razorpay reconciliation check failed, leaving order pending');
    return true;
  }
}

export async function releaseExpiredHolds(): Promise<{ released: number }> {
  const expired = await db.order.findMany({
    where: { status: 'PENDING_PAYMENT', reservedUntil: { lt: new Date() } },
    include: { items: true, payment: true },
  });

  let released = 0;
  for (const order of expired) {
    if (order.payment?.razorpayOrderId) {
      const reconciledOrUnconfirmed = await reconcileWithRazorpay(order.id, order.payment.razorpayOrderId);
      if (reconciledOrUnconfirmed) continue;
    }
    await db.$transaction((tx) => cancelPendingOrderTx(tx, order, 'Reservation expired', 'system'));
    released++;
  }

  if (released > 0) await invalidateProductCaches();
  return { released };
}
