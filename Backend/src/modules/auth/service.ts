import bcrypt from 'bcryptjs';
import { env } from '../../config/env';
import type { AdminLoginInput } from './schema';

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
