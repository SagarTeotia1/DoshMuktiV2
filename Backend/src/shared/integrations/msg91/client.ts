import { env } from '../../../config/env';

// OTP-based phone verification — schema (OtpVerification) is already in place,
// this client is the MSG91 wiring referenced by its `requestId` field.

export async function sendOtp(phone: string): Promise<{ requestId: string }> {
  if (!env.MSG91_AUTH_KEY) return { requestId: `dummy_${phone}` }; // graceful degrade in dev

  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: { authkey: env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: env.MSG91_TEMPLATE_ID, mobile: phone }),
  });
  const data = (await res.json()) as { request_id: string };
  return { requestId: data.request_id };
}

export async function verifyOtp(phone: string, otp: string): Promise<boolean> {
  if (!env.MSG91_AUTH_KEY) return otp === '000000'; // dev-mode fixed OTP

  const res = await fetch(
    `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${phone}`,
    { headers: { authkey: env.MSG91_AUTH_KEY } }
  );
  const data = (await res.json()) as { type: string };
  return data.type === 'success';
}
