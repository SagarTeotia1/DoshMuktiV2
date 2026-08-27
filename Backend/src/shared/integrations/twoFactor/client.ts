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

// Fixed test number — always OTP 000000, never hits 2Factor, never burns a real SMS
// credit. Deliberately NOT gated on NODE_ENV (works in prod too, per explicit request)
// — this is a real, narrow security tradeoff: anyone who knows this exact phone number
// can log in as it without ever receiving an SMS. Scoped as tight as possible (one
// hardcoded number, not a pattern) to limit the blast radius.
const DEV_TEST_PHONE = '+918595951170';
const DEV_TEST_OTP = '000000';
const DEV_TEST_REQUEST_ID = 'dev_test_number';
const isTestPhoneBypass = (phone: string) => phone === DEV_TEST_PHONE;

export async function sendOtp(phone: string): Promise<{ requestId: string }> {
  if (isTestPhoneBypass(phone)) {
    console.log(`[dev OTP] test number ${phone} -> ${DEV_TEST_OTP}`);
    return { requestId: DEV_TEST_REQUEST_ID };
  }

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
  if (sessionId === DEV_TEST_REQUEST_ID) return otp === DEV_TEST_OTP;

  if (!env.TWOFACTOR_API_KEY) return otp === '000000'; // dev-mode fixed OTP

  const res = await fetch(
    `https://2factor.in/API/V1/${env.TWOFACTOR_API_KEY}/SMS/VERIFY/${sessionId}/${otp}`
  );
  const data = (await res.json()) as { Status: string; Details: string };
  return data.Status === 'Success';
}
