import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env';

export async function verifyAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
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

// Stub for the future AI bot — not wired to any route yet. When the bot
// ships, apply this to specific read-only routes only, never blanket access.
export async function verifyServiceKey(req: FastifyRequest, reply: FastifyReply) {
  const key = req.headers['x-api-key'];
  if (!env.AI_BOT_SERVICE_KEY || key !== env.AI_BOT_SERVICE_KEY) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
