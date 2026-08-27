import { env } from '../../../config/env';

// OTP-based phone verification — schema (OtpVerification) is already in place,
// this client is the 2Factor.in wiring referenced by its `requestId` field
// (which stores 2Factor's session id).

export async function sendOtp(phone: string): Promise<{ requestId: string }> {
  if (!env.TWOFACTOR_API_KEY) {
    // graceful degrade in dev — no SMS provider wired, print the fixed dev OTP instead
    console.log(`[dev OTP] ${phone} -> 000000`);
    return { requestId: `dummy_${phone}` };
  }

  const res = await fetch(
    `https://2factor.in/API/V1/${env.TWOFACTOR_API_KEY}/SMS/${phone}/AUTOGEN`
  );
  const data = (await res.json()) as { Status: string; Details: string };
  if (data.Status !== 'Success') {
    throw new Error(`2Factor send OTP failed: ${data.Details}`);
  }
  return { requestId: data.Details };
}

export async function verifyOtp(sessionId: string, otp: string): Promise<boolean> {
  if (!env.TWOFACTOR_API_KEY) return otp === '000000'; // dev-mode fixed OTP

  const res = await fetch(
    `https://2factor.in/API/V1/${env.TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`
  );
  const data = (await res.json()) as { Status: string; Details: string };
  return data.Status === 'Success';
}
