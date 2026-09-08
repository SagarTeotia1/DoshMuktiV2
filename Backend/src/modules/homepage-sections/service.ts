import { db } from '../../shared/db/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import { withOffers, attachRatings, type ProductWithRating } from '../products/service';
import type { CreateSectionInput, UpdateSectionInput } from './schema';

export class HomepageSectionNotFoundError extends Error {
  constructor(public id: string) {
    super(`Homepage section not found: ${id}`);
    this.name = 'HomepageSectionNotFoundError';
  }
}

// Thrown by createSection on a unique-constraint violation on `key` (P2002) — a
// clear, named error instead of letting the raw Prisma error leak to the controller.
export class HomepageSectionKeyTakenError extends Error {
  constructor(public key: string) {
    super(`Homepage section key already exists: ${key}`);
    this.name = 'HomepageSectionKeyTakenError';
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

async function invalidateHomepageSectionsCache() {
  await redis.del(cacheKeys.activeHomepageSections());
}

// Public, storefront-facing — active sections only, in display order, each carrying
// its curated products shaped exactly like every other storefront product listing
// (offers applied + rating/excerpt attached) so the Frontend can render it straight
// into the same ProductCard it already uses elsewhere. Cached since this is hit on
// every home page load. Sections that resolve to zero products (all items removed,
// or every item's product went inactive/archived) are dropped from the response so
// the Frontend never has to special-case an empty rail.
export async function getActiveHomepageSections() {
  const key = cacheKeys.activeHomepageSections();
  const cached = await redis.get(key);
  if (cached) return cached;

  const sections = await db.homepageSection.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: {
      items: {
        where: { product: { status: 'ACTIVE' } },
        orderBy: { order: 'asc' },
        include: { product: { include: { variants: { where: { isActive: true } } } } },
      },
    },
  });

  // Shape every product once, across all sections, then reconstitute per-section
  // order from the shaped map — withOffers/attachRatings both batch their DB work,
  // so this is one offers pass + one ratings pass total instead of one per section.
  const allProducts = sections.flatMap((s) => s.items.map((i) => i.product));
  const byId = new Map<string, ProductWithRating>();
  if (allProducts.length > 0) {
    const withOffersApplied = await withOffers(allProducts);
    const rated = await attachRatings(withOffersApplied);
    for (const p of rated) byId.set(p.id, p);
  }

  const shaped = sections
    .map((s) => ({
      id: s.id,
      key: s.key,
      title: s.title,
      order: s.order,
      products: s.items.map((i) => byId.get(i.productId)).filter((p): p is ProductWithRating => p !== undefined),
    }))
    .filter((s) => s.products.length > 0);

  await redis.set(key, shaped, { ex: CACHE_TTL.HOMEPAGE_SECTIONS });
  return shaped;
}

// ─── Admin — no caching, sees inactive sections too ─────────────────────────

export async function listHomepageSectionsForAdmin() {
  return db.homepageSection.findMany({
    orderBy: { order: 'asc' },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: {
          product: { select: { id: true, name: true, slug: true, images: true, status: true } },
        },
      },
    },
  });
}

export async function createSection(input: CreateSectionInput) {
  try {
    const section = await db.homepageSection.create({ data: input });
    await invalidateHomepageSectionsCache();
    return section;
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new HomepageSectionKeyTakenError(input.key);
    throw err;
  }
}

export async function updateSection(id: string, input: UpdateSectionInput) {
  const existing = await db.homepageSection.findUnique({ where: { id } });
  if (!existing) throw new HomepageSectionNotFoundError(id);

  const section = await db.homepageSection.update({
    where: { id },
    data: { title: input.title, order: input.order, isActive: input.isActive },
  });
  await invalidateHomepageSectionsCache();
  return section;
}

// Replaces the full item list for a section in one transaction — delete every existing
// item row, then recreate with `order` set from the array's index. Simpler and safer
// than diffing add/remove/reorder client-side; the admin UI just sends the full desired
// product id order every time it saves.
export async function setSectionItems(id: string, productIds: string[]) {
  const existing = await db.homepageSection.findUnique({ where: { id } });
  if (!existing) throw new HomepageSectionNotFoundError(id);

  await db.$transaction([
    db.homepageSectionItem.deleteMany({ where: { sectionId: id } }),
    db.homepageSectionItem.createMany({
      data: productIds.map((productId, index) => ({ sectionId: id, productId, order: index })),
    }),
  ]);
  await invalidateHomepageSectionsCache();

  return db.homepageSection.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: 'asc' },
        include: { product: { select: { id: true, name: true, slug: true, images: true, status: true } } },
      },
    },
  });
}

export async function deleteSection(id: string) {
  const existing = await db.homepageSection.findUnique({ where: { id } });
  if (!existing) throw new HomepageSectionNotFoundError(id);

  await db.homepageSection.delete({ where: { id } });
  await invalidateHomepageSectionsCache();
}
