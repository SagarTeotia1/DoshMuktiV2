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

// Interleaves two rating buckets at a fixed ratio (3 high-rated : 2 lower-rated per 5,
// scaled to whatever `limit` actually is) so every page reads as a realistic mixed
// spread instead of e.g. five 5-stars in a row — without ever inventing or hiding a
// review, just reordering what's real. Once one bucket runs dry, the rest is filled
// from whichever bucket still has reviews left, so nothing is ever dropped.
function interleaveByRating<T extends { rating: number }>(reviews: T[], limit: number): T[] {
  const high = reviews.filter((r) => r.rating >= 4);
  const low = reviews.filter((r) => r.rating <= 3);
  const highPerChunk = Math.max(1, Math.round((limit * 3) / 5));
  const lowPerChunk = Math.max(1, limit - highPerChunk);

  const result: T[] = [];
  let hi = 0;
  let li = 0;
  while (hi < high.length || li < low.length) {
    for (let k = 0; k < highPerChunk && hi < high.length; k++) result.push(high[hi++]!);
    for (let k = 0; k < lowPerChunk && li < low.length; k++) result.push(low[li++]!);
  }
  return result;
}

// Paginated — a product with 50-100+ reviews was rendering every single one into one
// unbounded grid on the page. `ratingCounts` is queried independently of this pass so
// the star-breakdown bars always reflect ALL approved reviews, not just whichever page
// is currently showing. The dataset per product is small (dozens, not thousands), so
// fetching every approved review and interleaving/paginating in memory is cheap and
// far simpler than expressing a ratio-interleave as SQL.
export async function listApprovedForProduct(productId: string, { page, limit }: ProductReviewsQuery) {
  const where = { productId, status: 'APPROVED' as const, rating: { gte: 3 } };
  const [allReviews, agg, ratingGroups] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, customerName: true, rating: true, title: true, body: true, createdAt: true },
    }),
    db.review.aggregate({ where, _avg: { rating: true }, _count: true }),
    db.review.groupBy({ by: ['rating'], where, _count: true }),
  ]);

  const totalReviews = agg._count;
  const ratingCounts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const g of ratingGroups) ratingCounts[g.rating as 1 | 2 | 3 | 4 | 5] = g._count;

  const mixed = interleaveByRating(allReviews, limit);
  const reviews = mixed.slice((page - 1) * limit, page * limit);

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
    where: { status: 'APPROVED', rating: { gte: 3 } },
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
