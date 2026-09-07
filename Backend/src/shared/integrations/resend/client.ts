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

// Fired once Delhivery hands back a waybill for the order (see webhooks/service.ts) —
// the only push notification a customer gets about their tracking ID today. There's no
// SMS path for this: 2Factor is wired for OTP login only (a DLT-approved OTP template),
// and a transactional "order shipped" SMS needs its own separately DLT-registered
// template before it can be sent — that's a compliance step, not a code change. Email
// is optional at checkout, so this silently reaches only customers who gave one; a
// customer without an email still has their tracking ID via /track/:orderNumber, they
// just aren't proactively told.
export async function sendShipmentNotification(to: string, orderNumber: string, waybill: string) {
  if (!resend) return;
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Your order is on its way — ${orderNumber}`,
    html: `<p>Your order <strong>${orderNumber}</strong> has shipped.</p>
<p>Tracking ID: <strong>${waybill}</strong></p>
<p><a href="https://www.delhivery.com/track/package/${waybill}">Track your package</a></p>`,
  });
}
