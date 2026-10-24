import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import { db } from '../../shared/db/client';
import { sendOtp, verifyOtp } from '../../shared/integrations/twoFactor/client';
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

export async function sendCustomerOtp(rawPhone: string): Promise<void> {
  const phone = normalizePhone(rawPhone);
  const { requestId } = await sendOtp(phone);
  await db.otpVerification.create({
    data: { phone, requestId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
}

export async function verifyCustomerOtp(rawPhone: string, otp: string): Promise<{ user: User; isNewUser: boolean }> {
  const phone = normalizePhone(rawPhone);

  // Every login checks a real OTP, and each OTP logs in exactly once. (This used to accept
  // ANY otp for 10 minutes after a phone's last successful verify — anyone knowing a
  // customer's number could log in as them in that window.)
  const record = await db.otpVerification.findFirst({
    where: { phone, verified: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) throw new InvalidOtpError();

  const ok = await verifyOtp(record.requestId, otp);
  if (!ok) throw new InvalidOtpError();

  // Consume atomically — of two concurrent verifies with the same OTP, only one wins.
  const consumed = await db.otpVerification.updateMany({
    where: { id: record.id, verified: false },
    data: { verified: true },
  });
  if (consumed.count === 0) throw new InvalidOtpError();

  const existing = await db.user.findUnique({ where: { phone } });
  if (existing) return { user: existing, isNewUser: false };

  const user = await db.user.create({ data: { phone } });
  return { user, isNewUser: true };
}
