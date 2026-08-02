import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import type { ListProductsQuery } from './schema';

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

  const rated = await attachRatings(products);
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

  const [rated] = await attachRatings([product]);
  await redis.set(key, rated, { ex: CACHE_TTL.PRODUCT_DETAIL });
  return rated;
}

export async function getRelatedProducts(productId: string, purpose: string[], limit = 4) {
  const products = await db.product.findMany({
    where: { status: 'ACTIVE', id: { not: productId }, purpose: { hasSome: purpose } },
    include: { variants: { where: { isActive: true } } },
    take: limit,
  });
  return attachRatings(products);
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

  const rated = await attachRatings(products);
  await redis.set(key, rated, { ex: CACHE_TTL.FEATURED });
  return rated;
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

export async function getProductByIdForAdmin(id: string) {
  return db.product.findUnique({ where: { id }, include: { variants: true } });
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
  return { products, total, pages: Math.ceil(total / query.limit), page: query.page };
}

export class DuplicateSlugError extends Error {
  constructor(public slug: string) {
    super(`Slug already in use: ${slug}`);
    this.name = 'DuplicateSlugError';
  }
}

export async function createProduct(input: CreateProductInput) {
  const existing = await db.product.findUnique({ where: { slug: input.slug } });
  if (existing) throw new DuplicateSlugError(input.slug);

  const product = await db.product.create({
    data: {
      ...input,
      images: input.images as unknown as Prisma.InputJsonValue,
      benefits: input.benefits as unknown as Prisma.InputJsonValue,
      howToWear: input.howToWear as unknown as Prisma.InputJsonValue,
    },
  });
  await invalidateProductCaches();
  return product;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  if (input.slug) {
    const existing = await db.product.findUnique({ where: { slug: input.slug } });
    if (existing && existing.id !== id) throw new DuplicateSlugError(input.slug);
  }

  const product = await db.product.update({
    where: { id },
    data: {
      ...input,
      images: input.images as unknown as Prisma.InputJsonValue | undefined,
      benefits: input.benefits as unknown as Prisma.InputJsonValue | undefined,
      howToWear: input.howToWear as unknown as Prisma.InputJsonValue | undefined,
    },
  });
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
