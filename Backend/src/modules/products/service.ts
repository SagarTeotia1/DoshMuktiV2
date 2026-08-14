import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import { attachApplicableOffers, type OfferWithCoupon } from '../offers/service';
import type { ListProductsQuery, DescriptionBlock } from './schema';

// Short plain-text teaser derived from the first text block of the structured
// description — used for product-card excerpts. Never stored; always computed
// on read so it can't drift from the blocks the admin actually edits.
function deriveExcerpt(description: unknown): string {
  const blocks = Array.isArray(description) ? (description as DescriptionBlock[]) : [];
  const firstText = blocks.find((b): b is Extract<DescriptionBlock, { type: 'text' }> => b.type === 'text');
  if (!firstText) return '';
  const content = firstText.content.trim();
  return content.length > 160 ? `${content.slice(0, 157)}...` : content;
}

function withExcerpt<T extends { description: unknown }>(products: T[]): Array<T & { excerpt: string }> {
  return products.map((p) => ({ ...p, excerpt: deriveExcerpt(p.description) }));
}

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
type ProductWithRating = ProductWithVariants & { rating: { average: number; count: number }; excerpt: string };

// Storefront-facing products always get both a rating summary and a derived plain-text
// excerpt attached in the same pass — every caller of attachRatings is a storefront read,
// so this is the one place to compute `excerpt` without touching each call site.
async function attachRatings<T extends { id: string; description: unknown }>(
  products: T[]
): Promise<Array<T & { rating: { average: number; count: number }; excerpt: string }>> {
  if (products.length === 0) return [];
  const grouped = await db.review.groupBy({
    by: ['productId'],
    where: { productId: { in: products.map((p) => p.id) }, status: 'APPROVED' },
    _avg: { rating: true },
    _count: true,
  });
  const byId = new Map(grouped.map((g) => [g.productId, { average: g._avg.rating ?? 0, count: g._count }]));
  const withRating = products.map((p) => ({ ...p, rating: byId.get(p.id) ?? { average: 0, count: 0 } }));
  return withExcerpt(withRating);
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
    // `description` is now a structured Json block array, not free text — Prisma's
    // string `contains` filter no longer applies to it, so search is name/category only.
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { category: { contains: query.q, mode: 'insensitive' } },
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

// Used by the Acharya chat bot to recommend real products for a purpose without ever
// exposing price in the chat turn — deliberately narrow select, no offers/ratings, this
// isn't a storefront listing.
export async function getProductsForChatRecommendation(purpose: string, limit = 3) {
  const products = await db.product.findMany({
    where: { status: 'ACTIVE', purpose: { has: purpose } },
    select: { id: true, name: true, slug: true, images: true },
    orderBy: { featured: 'desc' },
    take: limit,
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    thumb: (Array.isArray(p.images) && (p.images[0] as { thumb?: unknown } | undefined)?.thumb) || null,
  })) as Array<{ id: string; name: string; slug: string; thumb: string | null }>;
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
      description: rest.description as unknown as Prisma.InputJsonValue,
      images: rest.images as unknown as Prisma.InputJsonValue,
      benefits: rest.benefits as unknown as Prisma.InputJsonValue,
      howToWear: rest.howToWear as unknown as Prisma.InputJsonValue,
      testimonialVideos: rest.testimonialVideos as unknown as Prisma.InputJsonValue,
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
      description: rest.description as unknown as Prisma.InputJsonValue | undefined,
      images: rest.images as unknown as Prisma.InputJsonValue | undefined,
      benefits: rest.benefits as unknown as Prisma.InputJsonValue | undefined,
      howToWear: rest.howToWear as unknown as Prisma.InputJsonValue | undefined,
      testimonialVideos: rest.testimonialVideos as unknown as Prisma.InputJsonValue | undefined,
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
