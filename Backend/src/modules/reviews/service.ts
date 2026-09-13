import { db } from '../../shared/db/client';
import type { CreateReviewInput, AdminListReviewsQuery, ModerateReviewInput, ProductReviewsQuery } from './schema';

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

// Paginated — a product with 50-100+ reviews was rendering every single one into one
// unbounded grid on the page. `ratingCounts` is queried independently of the paginated
// `reviews` page so the star-breakdown bars always reflect ALL approved reviews, not
// just whichever page is currently showing.
export async function listApprovedForProduct(productId: string, { page, limit }: ProductReviewsQuery) {
  const [reviews, agg, ratingGroups] = await Promise.all([
    db.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, customerName: true, rating: true, title: true, body: true, createdAt: true },
    }),
    db.review.aggregate({ where: { productId, status: 'APPROVED' }, _avg: { rating: true }, _count: true }),
    db.review.groupBy({ by: ['rating'], where: { productId, status: 'APPROVED' }, _count: true }),
  ]);

  const totalReviews = agg._count;
  const ratingCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const g of ratingGroups) ratingCounts[g.rating as 1 | 2 | 3 | 4 | 5] = g._count;

  return {
    reviews,
    averageRating: agg._avg.rating ?? 0,
    totalReviews,
    ratingCounts,
    page,
    pages: Math.max(1, Math.ceil(totalReviews / limit)),
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
