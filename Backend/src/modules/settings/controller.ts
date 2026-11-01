import type { FastifyRequest, FastifyReply } from 'fastify';
import { codFeeConfigSchema } from './schema';
import { getCodFeeConfig, setCodFeeConfig } from './service';

export async function getCodFeeHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getCodFeeConfig());
}

export async function updateCodFeeHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = codFeeConfigSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid COD fee settings', details: parsed.error.flatten().fieldErrors });
  return reply.send(await setCodFeeConfig(parsed.data));
}
