import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env';

export async function verifyAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  // Customer logins (phone OTP) are signed with the same key, so a valid signature alone is
  // not proof of an admin: only tokens issued by the admin login carry role "admin".
  if ((req.user as { role?: string }).role !== 'admin') {
    return reply.code(403).send({ error: 'Forbidden' });
  }
}

export async function verifyCustomer(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  if ((req.user as { role?: string }).role !== 'customer') {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

// Guest checkout: a valid customer JWT is used when present, but its absence is not an
// error — the handler then identifies the buyer by the phone they typed. A token that is
// present but invalid/non-customer is simply ignored (req.user stays unset).
export async function optionalCustomer(req: FastifyRequest) {
  if (!req.headers.authorization) return;
  try {
    await req.jwtVerify();
    if ((req.user as { role?: string }).role !== 'customer') (req as { user: unknown }).user = undefined;
  } catch {
    (req as { user: unknown }).user = undefined;
  }
}

// Stub for the future AI bot — not wired to any route yet. When the bot
// ships, apply this to specific read-only routes only, never blanket access.
export async function verifyServiceKey(req: FastifyRequest, reply: FastifyReply) {
  const key = req.headers['x-api-key'];
  if (!env.AI_BOT_SERVICE_KEY || key !== env.AI_BOT_SERVICE_KEY) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
