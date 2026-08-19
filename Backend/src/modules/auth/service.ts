import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { db } from '../../shared/db/client';
import { sendOtp, verifyOtp } from '../../shared/integrations/msg91/client';
import { normalizePhone } from '../../shared/utils/phone';
import type { AdminLoginInput } from './schema';
import type { User } from '@prisma/client';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export async function verifyAdminCredentials(input: AdminLoginInput): Promise<{ email: string; role: 'admin' }> {
  if (input.email !== env.ADMIN_EMAIL.toLowerCase()) throw new InvalidCredentialsError();

  const valid = await bcrypt.compare(input.password, env.ADMIN_PASSWORD_HASH);
  if (!valid) throw new InvalidCredentialsError();

  // role hardcoded today (single admin) — payload shape already supports
  // multiple roles once the admin team ships, see docs/SECURITY.md
  return { email: input.email, role: 'admin' };
}

export class InvalidOtpError extends Error {
  constructor() {
    super('Invalid or expired OTP');
    this.name = 'InvalidOtpError';
  }
}

export class ProfileRequiredError extends Error {
  constructor() {
    super('New account — name is required');
    this.name = 'ProfileRequiredError';
  }
}

export async function sendCustomerOtp(rawPhone: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const { requestId } = await sendOtp(phone);
  await db.otpVerification.create({
    data: { phone, requestId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
}

export async function verifyCustomerOtp(
  rawPhone: string,
  otp: string,
  name: string | undefined,
  dob: string | undefined
): Promise<User> {
  const phone = normalizePhone(rawPhone);

  // The profile step (name/dob) resubmits the same phone+otp after the OTP was already
  // verified and consumed on the first call — MSG91 OTPs are single-use, so re-checking
  // with the provider here would always fail. If this phone already has a verified,
  // unexpired record, treat it as still-authenticated instead of re-verifying.
  const alreadyVerified = await db.otpVerification.findFirst({
    where: { phone, verified: true, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!alreadyVerified) {
    const record = await db.otpVerification.findFirst({
      where: { phone, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new InvalidOtpError();

    const ok = await verifyOtp(phone, otp);
    if (!ok) throw new InvalidOtpError();

    await db.otpVerification.update({ where: { id: record.id }, data: { verified: true } });
  }

  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) {
    if (!name && !dob) return existing;
    return db.user.update({
      where: { id: existing.id },
      data: { name: name ?? existing.name, dob: dob ? new Date(dob) : existing.dob },
    });
  }

  if (!name) throw new ProfileRequiredError();
  return db.user.create({ data: { phone, name, dob: dob ? new Date(dob) : null } });
}
