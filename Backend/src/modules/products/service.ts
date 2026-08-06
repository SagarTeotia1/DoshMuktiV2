import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import { attachApplicableOffers, type OfferWithCoupon } from '../offers/service';
import type { ListProductsQuery } from './schema';

// Offers are no longer a plain Prisma relation include — CATEGORY/ALL_PRODUCTS-scoped
// offers apply without an explicit product link, so every storefront/admin read that
// used to `include: { offers: { where: { isActive: true } } }` now fetches products
// without `offers` and merges the scope-aware result from offers/service.ts's
// attachApplicableOffers on top, keyed by product id. Response shape is unchanged —
// callers still see `product.offers: Offer[]`, now widened to OfferWithCoupon[] so a
// COUPON_BASED offer's `coupon.code` and any set `minOrderValue` reach the storefront.
async function withOffers<T extends { id: string; category: string }>(products: T[]): Promise<Array<T & { offers: OfferWithCoupon[] }>> {
  if (products.length === 0) return [];
  const byProduct = await attachApplicableOffers(products);
  return products.map((p) => ({ ...p, offers: byProduct.get(p.id) ?? [] }));
}

type ProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: { where: { isActive: true } } } }>;
type ProductWithRating = ProductWithVariants & { rating: { average: number; count: number } };

async function attachRatings<T extends { id: string }>(products: T[]): Promise<Array<T & { rating: { average: number; count: number } }>> {
  if (products.length === 0) return [];
  const grouped = await db.review.groupBy({
    by: ['productId'],
    where: { productId: { in: products.map((p) => p.id) }, status: 'APPROVED' },
    _avg: { rating: true },
    _count: true,
  });
  const byId = new Map(grouped.map((g) => [g.productId, { average: g._avg.rating ?? 0, count: g._count }]));
  return products.map((p) => ({ ...p, rating: byId.get(p.id) ?? { average: 0, count: 0 } }));
}

export async function listProducts(query: ListProductsQuery) {
  const fingerprint = crypto.createHash('sha1').update(JSON.stringify(query)).digest('hex');
  const key = cacheKeys.productsListing(fingerprint);

  const cached = await redis.get<{ products: ProductWithRating[]; total: number; pages: number; page: number }>(key);
  if (cached) return cached;

  const where: Prisma.ProductWhereInput = {
    status: 'ACTIVE' as const,
    ...(query.purpose ? { purpose: { has: query.purpose } } : {}),
    ...(query.featured !== undefined ? { featured: query.featured } : {}),
    ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { category: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const orderBy =
    query.sort === 'price_asc' ? { basePrice: 'asc' as const }
    : query.sort === 'price_desc' ? { basePrice: 'desc' as const }
    : query.sort === 'popular' ? { featured: 'desc' as const }
    : { createdAt: 'desc' as const };

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { variants: { where: { isActive: true } } },
    }),
    db.product.count({ where }),
  ]);

  const withOffersApplied = await withOffers(products);
  const rated = await attachRatings(withOffersApplied);
  const result = { products: rated, total, pages: Math.ceil(total / query.limit), page: query.page };
  await redis.set(key, result, { ex: CACHE_TTL.PRODUCTS_LIST });
  return result;
}

export async function getProductBySlug(slug: string) {
  const key = cacheKeys.productSlug(slug);
  const cached = await redis.get<ProductWithRating>(key);
  if (cached) return cached;

  const product = await db.product.findFirst({
    where: { slug, status: 'ACTIVE' },
    include: { variants: { where: { isActive: true } } },
  });
  if (!product) return null;

  const [withOffersApplied] = await withOffers([product]);
  // noUncheckedIndexedAccess makes this destructure `T | undefined`, but the input array
  // always has exactly one element so the output always does too — safe to assert.
  const [rated] = await attachRatings([withOffersApplied!]);
  await redis.set(key, rated, { ex: CACHE_TTL.PRODUCT_DETAIL });
  return rated;
}

export async function getRelatedProducts(productId: string, purpose: string[], limit = 4) {
  const products = await db.product.findMany({
    where: { status: 'ACTIVE', id: { not: productId }, purpose: { hasSome: purpose } },
    include: { variants: { where: { isActive: true } } },
    take: limit,
  });
  const withOffersApplied = await withOffers(products);
  return attachRatings(withOffersApplied);
}

export async function getDistinctCategories(): Promise<string[]> {
  const key = cacheKeys.productCategories();
  const cached = await redis.get<string[]>(key);
  if (cached) return cached;

  const rows = await db.product.findMany({
    where: { status: 'ACTIVE' },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  const categories = rows.map((r) => r.category);

  await redis.set(key, categories, { ex: CACHE_TTL.CATEGORIES });
  return categories;
}

// Admin needs categories from DRAFT products too (to reuse when adding a new draft
// in the same category), so no status filter — and no cache, admin traffic is low.
export async function getDistinctCategoriesForAdmin(): Promise<string[]> {
  const rows = await db.product.findMany({
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  });
  return rows.map((r) => r.category);
}

export async function getFeaturedProducts(limit = 4) {
  const key = cacheKeys.featuredProducts(limit);
  const cached = await redis.get(key);
  if (cached) return cached;

  const products = await db.product.findMany({
    where: { status: 'ACTIVE', featured: true },
    include: { variants: { where: { isActive: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const withOffersApplied = await withOffers(products);
  const rated = await attachRatings(withOffersApplied);
  await redis.set(key, rated, { ex: CACHE_TTL.FEATURED });
  return rated;
}

// Reusable "which variant ships" rule: active variants of a product, richest stock
// first. Used by the storefront's own display logic and by offers/rewards/free-gift.ts
// to resolve which variant of a FREE_GIFT product to actually reserve/ship.
export async function getActiveVariantsSortedByStock(productId: string) {
  return db.productVariant.findMany({
    where: { productId, isActive: true },
    orderBy: { stockQuantity: 'desc' },
  });
}

// Called by inventory/product admin services after any write — not exposed as a route
export async function invalidateProductCaches() {
  const keys = await redis.keys('products:*');
  await Promise.all(keys.map((k) => redis.del(k)));
  const productKeys = await redis.keys('product:*');
  await Promise.all(productKeys.map((k) => redis.del(k)));
}

// ─── Admin — no caching, all statuses visible ──────────────────────────────

import type { ListAdminProductsQuery, CreateProductInput, UpdateProductInput, CreateVariantInput, UpdateVariantInput } from './schema';

// Admin reads intentionally do NOT filter offers by isActive (unlike the storefront
// reads above) — an admin editing a product should see every offer that would apply to
// it, archived ones included — same scope-aware resolution via attachApplicableOffers,
// just with includeInactive so nothing routes around the shared function.
async function withAllOffers<T extends { id: string; category: string }>(products: T[]): Promise<Array<T & { offers: OfferWithCoupon[] }>> {
  if (products.length === 0) return [];
  const byProduct = await attachApplicableOffers(products, { includeInactive: true });
  return products.map((p) => ({ ...p, offers: byProduct.get(p.id) ?? [] }));
}

export async function getProductByIdForAdmin(id: string) {
  const product = await db.product.findUnique({ where: { id }, include: { variants: true } });
  if (!product) return null;
  const [withOffersApplied] = await withAllOffers([product]);
  return withOffersApplied;
}

export async function listProductsForAdmin(query: ListAdminProductsQuery) {
  const where = query.status ? { status: query.status } : {};
  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { variants: true },
    }),
    db.product.count({ where }),
  ]);
  const withOffersApplied = await withAllOffers(products);
  return { products: withOffersApplied, total, pages: Math.ceil(total / query.limit), page: query.page };
}

export class DuplicateSlugError extends Error {
  constructor(public slug: string) {
    super(`Slug already in use: ${slug}`);
    this.name = 'DuplicateSlugError';
  }
}

// Keeps a real ProductVariant in sync with Product.sidhiPrice, so the Sidhi/Energizing
// add-on flows through cart/checkout/stock like any other SKU — never delete, only deactivate,
// matching the append-only convention used for StockMovement/RewardPoint/WalletTransaction.
async function syncSidhiVariant(productId: string, sidhiPrice: number | null | undefined) {
  if (sidhiPrice === undefined) return;
  const existing = await db.productVariant.findFirst({
    where: { productId, attributes: { path: ['type'], equals: 'service' } },
  });

  if (sidhiPrice === null) {
    if (existing) await db.productVariant.update({ where: { id: existing.id }, data: { isActive: false } });
    return;
  }

  if (existing) {
    await db.productVariant.update({
      where: { id: existing.id },
      data: { priceOverride: sidhiPrice, isActive: true, stockQuantity: 999_999 },
    });
  } else {
    await db.productVariant.create({
      data: {
        productId,
        sku: `SIDHI-${productId}`,
        attributes: { type: 'service', label: 'Sidhi / Energizing Service' },
        priceOverride: sidhiPrice,
        stockQuantity: 999_999,
        isActive: true,
      },
    });
  }
}

export async function createProduct(input: CreateProductInput) {
  const existing = await db.product.findUnique({ where: { slug: input.slug } });
  if (existing) throw new DuplicateSlugError(input.slug);

  const { offerIds, ...rest } = input;
  const product = await db.product.create({
    data: {
      ...rest,
      images: rest.images as unknown as Prisma.InputJsonValue,
      benefits: rest.benefits as unknown as Prisma.InputJsonValue,
      howToWear: rest.howToWear as unknown as Prisma.InputJsonValue,
      descriptionImages: rest.descriptionImages as unknown as Prisma.InputJsonValue,
      offers: offerIds && offerIds.length > 0 ? { connect: offerIds.map((id) => ({ id })) } : undefined,
    },
  });
  await syncSidhiVariant(product.id, input.sidhiPrice);
  await invalidateProductCaches();
  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  if (input.slug) {
    const existing = await db.product.findUnique({ where: { slug: input.slug } });
    if (existing && existing.id !== id) throw new DuplicateSlugError(input.slug);
  }

  const { offerIds, ...rest } = input;
  const product = await db.product.update({
    where: { id },
    data: {
      ...rest,
      images: rest.images as unknown as Prisma.InputJsonValue | undefined,
      benefits: rest.benefits as unknown as Prisma.InputJsonValue | undefined,
      howToWear: rest.howToWear as unknown as Prisma.InputJsonValue | undefined,
      descriptionImages: rest.descriptionImages as unknown as Prisma.InputJsonValue | undefined,
      // set fully replaces the linked offers — matches a checkbox-picker UX in Admin
      offers: offerIds !== undefined ? { set: offerIds.map((id) => ({ id })) } : undefined,
    },
  });
  await syncSidhiVariant(product.id, input.sidhiPrice);
  await invalidateProductCaches();
  return product;
}

export async function addVariant(productId: string, input: CreateVariantInput) {
  const variant = await db.productVariant.create({ data: { ...input, productId } });
  await invalidateProductCaches();
  return variant;
}

export async function updateVariant(variantId: string, input: UpdateVariantInput) {
  const variant = await db.productVariant.update({ where: { id: variantId }, data: input });
  await invalidateProductCaches();
  return variant;
}
