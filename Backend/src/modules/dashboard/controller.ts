import type { FastifyRequest, FastifyReply } from 'fastify';
import { salesQuerySchema } from './schema';
import { getDashboardSummary, getSalesTrend } from './service';

export async function getDashboardHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getDashboardSummary());
}

export async function getSalesTrendHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = salesQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });

  return reply.send(await getSalesTrend(parsed.data.days));
}
