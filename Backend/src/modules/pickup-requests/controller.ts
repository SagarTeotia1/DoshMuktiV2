import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPickupRequestSchema, listPickupRequestsQuerySchema } from './schema';
import { createPickupRequest, listPickupRequests, getPendingPickupCount, NoPendingShipmentsError } from './service';

export async function pendingPickupCountHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ count: await getPendingPickupCount() });
}

export async function listPickupRequestsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = listPickupRequestsQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });

  return reply.send(await listPickupRequests(parsed.data));
}

export async function createPickupRequestHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createPickupRequestSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const admin = (req.user as { sub: string }).sub;
  try {
    const result = await createPickupRequest(parsed.data, admin);
    return reply.send(result);
  } catch (err) {
    if (err instanceof NoPendingShipmentsError) return reply.code(409).send({ error: err.message });
    return reply.code(502).send({ error: err instanceof Error ? err.message : 'Pickup request failed' });
  }
}
