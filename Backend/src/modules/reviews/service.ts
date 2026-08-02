import { db } from '../../shared/db/client';
import type { CreateReviewInput, AdminListReviewsQuery, ModerateReviewInput } from './schema';

export class OrderNotFoundError extends Error {
  constructor() {
    super('Order not found');
    this.name = 'OrderNotFoundError';
  }
}

export class PhoneMismatchError extends Error {
  constructor() {
    super('Phone number does not match this order');
    this.name = 'PhoneMismatchError';
  }
}

export class OrderNotEligibleError extends Error {
  constructor() {
    super('This order is not eligible for a review yet');
    this.name = 'OrderNotEligibleError';
  }
}

export class ProductNotInOrderError extends Error {
  constructor() {
    super('This product was not part of that order');
    this.name = 'ProductNotInOrderError';
  }
}

export class DuplicateReviewError extends Error {
  constructor() {
    super('You have already reviewed this product for this order');
    this.name = 'DuplicateReviewError';
  }
}

const INELIGIBLE_STATUSES = new Set(['PENDING_PAYMENT', 'CANCELLED']);

export async function createReview(input: CreateReviewInput) {
  const order = await db.order.findUnique({
    where: { orderNumber: input.orderNumber },
    include: { items: { include: { variant: { select: { productId: true } } } } },
  });
  if (!order) throw new OrderNotFoundError();
  if (order.customerPhone !== input.customerPhone) throw new PhoneMismatchError();
  if (INELIGIBLE_STATUSES.has(order.status)) throw new OrderNotEligibleError();
  if (!order.items.some((item) => item.variant.productId === input.productId)) throw new ProductNotInOrderError();

  const existing = await db.review.findUnique({
    where: { orderId_productId: { orderId: order.id, productId: input.productId } },
  });
  if (existing) throw new DuplicateReviewError();

  return db.review.create({
    data: {
      productId: input.productId,
      orderId: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      rating: input.rating,
      title: input.title,
      body: input.body,
      status: 'PENDING',
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
