import { Resend } from 'resend';
import { env } from '../../../config/env';

export const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendOrderConfirmation(to: string, orderNumber: string, total: number) {
  if (!resend) return; // graceful degrade — no key configured in dev
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Order Confirmed — ${orderNumber}`,
    html: `<p>Your order <strong>${orderNumber}</strong> for ₹${total.toFixed(2)} is confirmed.</p>`,
  });
}
