import type { FastifyRequest, FastifyReply } from 'fastify';
import { pincodeQuerySchema } from './schema';
import { isPincodeServiceable } from './service';

export async function checkServiceabilityHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = pincodeQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid pincode' });

  const serviceable = await isPincodeServiceable(parsed.data.pincode);
  return reply.send({ serviceable });
}
