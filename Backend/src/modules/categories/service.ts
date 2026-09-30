import { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys } from '../../shared/cache/keys';
import { logger } from '../../shared/logger/pino';
import type { CreateCategoryInput, UpdateCategoryInput } from './schema';

type CategoryImage = { thumb: string; card: string; full: string };

export class CategoryNotFoundError extends Error {
  constructor(public id: string) {
    super(`Category not found: ${id}`);
    this.name = 'CategoryNotFoundError';
  }
}

export class DuplicateCategoryError extends Error {
  constructor(public categoryName: string) {
    super(`A category named "${categoryName}" already exists`);
    this.name = 'DuplicateCategoryError';
  }
}

export class CategoryInUseError extends Error {
  constructor(public productCount: number) {
    super(`Category still has ${productCount} product${productCount === 1 ? '' : 's'} — move or remove them first, or mark it inactive instead`);
    this.name = 'CategoryInUseError';
  }
}

// Prisma's Json? columns reject a plain JS `null` — must be the Prisma.JsonNull sentinel.
function toJsonInput(value: CategoryImage | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === null) return Prisma.JsonNull;
  return value;
}

async function invalidateCategoryCaches() {
  await Promise.all([redis.del(cacheKeys.productCategories()), redis.del(cacheKeys.categoryThumbnails())]);
}

// A rename changes what every product listing/detail response contains.
async function invalidateAllProductCaches() {
  const keys = [...(await redis.keys('products:*')), ...(await redis.keys('product:*'))];
  await Promise.all(keys.map((k) => redis.del(k)));
}

// Fallback image source: newest ACTIVE product's first image in this category.
async function latestProductImage(category: string): Promise<CategoryImage | null> {
  const product = await db.product.findFirst({
    where: { status: 'ACTIVE', categories: { has: category } },
    select: { images: true },
    orderBy: { createdAt: 'desc' },
  });
  const first = Array.isArray(product?.images) ? (product.images[0] as CategoryImage | undefined) : undefined;
  return first ?? null;
}

// ─── Admin ─────────────────────────────────────────────────────────────

export async function listCategoriesForAdmin() {
  const categories = await db.category.findMany({ orderBy: [{ order: 'asc' }, { name: 'asc' }] });
  return Promise.all(
    categories.map(async (c) => {
      const [productCount, fallbackImage] = await Promise.all([
        db.product.count({ where: { categories: { has: c.name } } }),
        c.image ? Promise.resolve(null) : latestProductImage(c.name),
      ]);
      return { ...c, productCount, fallbackImage };
    })
  );
}

export async function createCategory(input: CreateCategoryInput) {
  const existing = await db.category.findUnique({ where: { name: input.name } });
  if (existing) throw new DuplicateCategoryError(input.name);

  const category = await db.category.create({ data: { ...input, stripLabel: input.stripLabel ?? null, image: toJsonInput(input.image) } });
  await invalidateCategoryCaches();
  return category;
}

// Name isn't an FK anywhere — Product.categories and Offer.category hold the raw string —
// so a rename has to rewrite both in the same transaction or products silently fall out
// of their category.
export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) throw new CategoryNotFoundError(id);

  const newName = input.name;
  const renaming = newName !== undefined && newName !== existing.name;
  if (renaming) {
    const clash = await db.category.findUnique({ where: { name: newName } });
    if (clash) throw new DuplicateCategoryError(newName);
  }

  const data: Prisma.CategoryUpdateInput = { name: newName, stripLabel: input.stripLabel, order: input.order, isActive: input.isActive };
  if (input.image !== undefined) data.image = toJsonInput(input.image);

  const category = await db.$transaction(async (tx) => {
    if (renaming) {
      await tx.$executeRaw`UPDATE "Product" SET "categories" = array_replace("categories", ${existing.name}, ${newName}) WHERE ${existing.name} = ANY("categories")`;
      await tx.offer.updateMany({ where: { category: existing.name }, data: { category: newName } });
    }
    return tx.category.update({ where: { id }, data });
  });

  await invalidateCategoryCaches();
  if (renaming) await invalidateAllProductCaches();
  return category;
}

export async function deleteCategory(id: string) {
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) throw new CategoryNotFoundError(id);

  const productCount = await db.product.count({ where: { categories: { has: existing.name } } });
  if (productCount > 0) throw new CategoryInUseError(productCount);

  await db.category.delete({ where: { id } });
  await invalidateCategoryCaches();
}

// ─── Shared with products / offers ─────────────────────────────────────

// Products can still arrive with a category name not in the table yet (seed script, older
// clients) — create those rows so the table stays the complete list.
// Best-effort: a failure here (e.g. migration not applied yet) must never block saving a product.
export async function ensureCategoriesExist(names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return;
  try {
    const created = await db.category.createMany({ data: unique.map((name) => ({ name })), skipDuplicates: true });
    if (created.count > 0) await invalidateCategoryCaches();
  } catch (err) {
    logger.error({ err }, 'ensureCategoriesExist failed — product save continues');
  }
}

export async function categoryExists(name: string): Promise<boolean> {
  return (await db.category.findUnique({ where: { name }, select: { id: true } })) !== null;
}

export async function getAdminCategoryNames(): Promise<string[]> {
  const rows = await db.category.findMany({ select: { name: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] });
  return rows.map((r) => r.name);
}

// ─── Storefront ────────────────────────────────────────────────────────

export type CategoryThumb = { id: string; label: string; stripLabel: string | null; image: string | null };

// Active categories that currently have at least one ACTIVE product, in admin order.
// Image = admin-uploaded one, else the latest product's. Cached by callers.
export async function getStorefrontCategories(): Promise<CategoryThumb[]> {
  try {
    return await loadStorefrontCategories();
  } catch (err) {
    // Category table missing/unreachable (e.g. code deployed before the migration) — fall
    // back to the old behaviour of deriving categories from products so the storefront keeps working.
    logger.error({ err }, 'Category table read failed — falling back to product-derived categories');
    return derivedStorefrontCategories();
  }
}

async function derivedStorefrontCategories(): Promise<CategoryThumb[]> {
  const products = await db.product.findMany({ where: { status: 'ACTIVE' }, select: { categories: true } });
  const names = [...new Set(products.flatMap((p) => p.categories))].sort();
  return Promise.all(
    names.map(async (name): Promise<CategoryThumb> => ({ id: name, label: name, stripLabel: null, image: (await latestProductImage(name))?.card ?? null }))
  );
}

async function loadStorefrontCategories(): Promise<CategoryThumb[]> {
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { isActive: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
    db.product.findMany({ where: { status: 'ACTIVE' }, select: { categories: true } }),
  ]);
  const inUse = new Set(products.flatMap((p) => p.categories));

  return Promise.all(
    categories
      .filter((c) => inUse.has(c.name))
      .map(async (c): Promise<CategoryThumb> => {
        const image = (c.image as CategoryImage | null) ?? (await latestProductImage(c.name));
        return { id: c.name, label: c.name, stripLabel: c.stripLabel, image: image?.card ?? null };
      })
  );
}
