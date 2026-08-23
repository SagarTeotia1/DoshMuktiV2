import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  createReviewSchema,
  slugParamSchema,
  adminListReviewsQuerySchema,
  moderateReviewSchema,
  idParamSchema,
} from './schema';
import {
  createReview,
  listApprovedForProduct,
  listRecentApproved,
  listForAdmin,
  moderateReview,
  ProductNotFoundError,
} from './service';
import { getProductBySlug } from '../products/service';

export async function createReviewHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const review = await createReview(parsed.data);
    return reply.code(201).send({ id: review.id, status: review.status });
  } catch (err) {
    if (err instanceof ProductNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}

export async function getProductReviewsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = slugParamSchema.safeParse(req.params);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid slug' });

  const product = await getProductBySlug(parsed.data.slug);
  if (!product) return reply.code(404).send({ error: 'Product not found' });

  return reply.send(await listApprovedForProduct(product.id));
}

export async function getRecentReviewsHandler(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listRecentApproved(8));
}

export async function adminListReviewsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = adminListReviewsQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });
  return reply.send(await listForAdmin(parsed.data));
}

export async function adminModerateReviewHandler(req: FastifyRequest, reply: FastifyReply) {
  const params = idParamSchema.safeParse(req.params);
  if (!params.success) return reply.code(400).send({ error: 'Invalid id' });

  const parsed = moderateReviewSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const review = await moderateReview(params.data.id, parsed.data);
  return reply.send(review);
}
