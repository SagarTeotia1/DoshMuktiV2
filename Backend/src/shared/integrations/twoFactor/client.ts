import { randomInt } from 'crypto';
import { env } from '../../../config/env';

// OTP-based phone verification — schema (OtpVerification) is already in place,
// this client is the 2Factor.in wiring referenced by its `requestId` field
// (which stores 2Factor's session id).
//
// Uses 2Factor's "Send OTP - Custom OTP" API with the DLT-approved `OTP1`
// template (their default AUTOGEN template is unregistered and silently
// fails to deliver under India's DLT SMS regulations). Because the Custom
// OTP variant requires the caller to supply the OTP digits in the URL, the
// OTP is generated locally here (not by 2Factor) and 2Factor is just used
// to deliver it via the approved template.
//
// NOTE: a second template, OTP2 (proper DLT-registered, sender id DOSHHM),
// exists and is DLT-APPROVED but currently delivers via voice call instead
// of SMS for reasons still unconfirmed with 2Factor support (likely the PE
// ID not yet linked to this account — see 2Factor's approval email). Stuck
// on OTP1 until that's resolved — swap TEMPLATE_NAME back to 'OTP2' once confirmed.
const TEMPLATE_NAME = 'OTP1';

export async function sendOtp(phone: string): Promise<{ requestId: string }> {
  if (!env.TWOFACTOR_API_KEY) {
    // graceful degrade in dev — no SMS provider wired, print the fixed dev OTP instead
    console.log(`[dev OTP] ${phone} -> 000000`);
    return { requestId: `dummy_${phone}` };
  }

  const otp = randomInt(100000, 1000000); // 6-digit OTP, generated locally

  const res = await fetch(
    `https://2factor.in/API/V1/${env.TWOFACTOR_API_KEY}/SMS/${phone}/${otp}/${TEMPLATE_NAME}`
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
