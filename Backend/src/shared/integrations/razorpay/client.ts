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
