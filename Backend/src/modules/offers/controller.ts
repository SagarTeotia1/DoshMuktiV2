import type { FastifyRequest, FastifyReply } from 'fastify';
import { createOfferSchema, updateOfferSchema, idParamSchema } from './schema';
import { listOffers, createOffer, updateOffer } from './service';

export async function listOffersHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listOffers());
}

export async function createOfferHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createOfferSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const offer = await createOffer(parsed.data);
  return reply.code(201).send(offer);
}

export async function updateOfferHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = updateOfferSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const offer = await updateOffer(params.data.id, parsed.data);
  return reply.send(offer);
}
