import crypto from 'node:crypto';

/** Normalizes a 10-digit Indian mobile number to +91XXXXXXXXXX. Input is
 * assumed pre-validated by the route's zod schema (/^[6-9]\d{9}$/). */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return `+91${digits}`;
}

/** SHA-256(normalized phone) — the identity key for CustomerAddress/RewardPoint/
 * WalletTransaction. Never store the raw phone number in these ledgers. */
export function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(normalizePhone(phone)).digest('hex');
}
