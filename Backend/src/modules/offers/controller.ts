import type { FastifyRequest, FastifyReply } from 'fastify';
import { createOfferSchema, updateOfferSchema, idParamSchema, listOffersQuerySchema } from './schema';
import {
  listOffers,
  createOffer,
  updateOffer,
  duplicateOffer,
  OfferNotFoundError,
  CouponNotFoundError,
  CategoryNotFoundError,
  InvalidOfferScopeError,
  InvalidRewardConfigError,
} from './service';

function handleServiceError(err: unknown, reply: FastifyReply) {
  if (err instanceof OfferNotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof CouponNotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof CategoryNotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof InvalidOfferScopeError) return reply.code(400).send({ error: err.message });
  if (err instanceof InvalidRewardConfigError) {
    return reply.code(400).send({ error: 'Invalid input', details: err.issues });
  }
  throw err;
}

export async function listOffersHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = listOffersQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });

  return reply.send(await listOffers(parsed.data));
}

export async function createOfferHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createOfferSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const offer = await createOffer(parsed.data);
    return reply.code(201).send(offer);
  } catch (err) {
    return handleServiceError(err, reply);
  }
}

export async function updateOfferHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = updateOfferSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const offer = await updateOffer(params.data.id, parsed.data);
    return reply.send(offer);
  } catch (err) {
    return handleServiceError(err, reply);
  }
}

export async function duplicateOfferHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  try {
    const offer = await duplicateOffer(params.data.id);
    return reply.code(201).send(offer);
  } catch (err) {
    return handleServiceError(err, reply);
  }
}
