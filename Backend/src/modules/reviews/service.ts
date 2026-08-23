import { db } from '../../shared/db/client';
import type { CreateReviewInput, AdminListReviewsQuery, ModerateReviewInput } from './schema';

export class ProductNotFoundError extends Error {
  constructor() {
    super('Product not found');
    this.name = 'ProductNotFoundError';
  }
}

export async function createReview(input: CreateReviewInput) {
  const product = await db.product.findUnique({ where: { id: input.productId }, select: { id: true } });
  if (!product) throw new ProductNotFoundError();

  return db.review.create({
    data: {
      productId: input.productId,
      customerName: input.customerName,
      rating: input.rating,
      title: input.title,
      body: input.body,
      status: 'APPROVED',
    },
  });
}

export async function listApprovedForProduct(productId: string) {
  const [reviews, agg] = await Promise.all([
    db.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, customerName: true, rating: true, title: true, body: true, createdAt: true },
    }),
    db.review.aggregate({ where: { productId, status: 'APPROVED' }, _avg: { rating: true }, _count: true }),
  ]);

  return {
    reviews,
    averageRating: agg._avg.rating ?? 0,
    totalReviews: agg._count,
  };
}

export async function listRecentApproved(limit = 8) {
  return db.review.findMany({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      customerName: true,
      rating: true,
      title: true,
      body: true,
      createdAt: true,
      product: { select: { name: true, slug: true, images: true } },
    },
  });
}

export async function listForAdmin(query: AdminListReviewsQuery) {
  const where = query.status ? { status: query.status } : {};
  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { product: { select: { name: true, slug: true } } },
    }),
    db.review.count({ where }),
  ]);
  return { reviews, total, pages: Math.ceil(total / query.limit), page: query.page };
}

export async function moderateReview(id: string, input: ModerateReviewInput) {
  return db.review.update({ where: { id }, data: { status: input.status } });
}
