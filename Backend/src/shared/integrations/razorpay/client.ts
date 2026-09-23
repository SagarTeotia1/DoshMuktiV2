import Razorpay from 'razorpay';
import { env } from '../../../config/env';

export const razorpay = new Razorpay({
  key_id: env.RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});

// amountRupees is the full order total — always a full refund (this project has no
// partial-refund/return-one-item flow). Razorpay wants paise, and its refund is
// idempotent per payment when re-called with the same amount, so a retry after a
// transient failure never double-refunds.
export async function refundPayment(razorpayPaymentId: string, amountRupees: number): Promise<{ refundId: string }> {
  const refund = await razorpay.payments.refund(razorpayPaymentId, { amount: Math.round(amountRupees * 100) });
  return { refundId: refund.id };
}

// Used by jobs/release-holds.ts before it cancels a PENDING_PAYMENT order past its
// reservation window — our own /api/checkout/verify call (client-driven) and the
// Razorpay webhook are both the usual ways a payment gets reconciled, and both can miss
// an order (network blip, webhook not configured, etc). Asking Razorpay directly here is
// the actual source of truth: never auto-cancel an order the customer genuinely paid for
// just because neither of our own reconciliation paths happened to fire for it.
export async function findCapturedPayment(razorpayOrderId: string): Promise<{ razorpayPaymentId: string } | null> {
  const result = await razorpay.orders.fetchPayments(razorpayOrderId);
  const captured = result.items.find((p) => p.status === 'captured');
  return captured ? { razorpayPaymentId: captured.id } : null;
}
