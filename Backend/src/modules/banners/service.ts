import { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import type { CreateBannerInput, UpdateBannerInput } from './schema';

// Prisma's Json? columns reject a plain JS `null` in create/update input — it must be
// the sentinel `Prisma.JsonNull` to mean "set this JSON column to SQL NULL".
function toJsonInput(
  value: { thumb: string; card: string; full: string } | null | undefined
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === null) return Prisma.JsonNull;
  return value;
}

export class BannerNotFoundError extends Error {
  constructor(public id: string) {
    super(`Banner not found: ${id}`);
    this.name = 'BannerNotFoundError';
  }
}

async function invalidateBannerCache() {
  await redis.del(cacheKeys.activeBanners());
}

// Public, storefront-facing — active banners only, ordered for display. Cached since
// this is hit on every home page load.
export async function getActiveBanners() {
  const key = cacheKeys.activeBanners();
  const cached = await redis.get(key);
  if (cached) return cached;

  const banners = await db.banner.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });

  await redis.set(key, banners, { ex: CACHE_TTL.BANNERS });
  return banners;
}

// ─── Admin — no caching, sees inactive banners too ─────────────────────────

export async function listBannersForAdmin() {
  return db.banner.findMany({ orderBy: { order: 'asc' } });
}

export async function createBanner(input: CreateBannerInput) {
  const banner = await db.banner.create({ data: { ...input, mobileImage: toJsonInput(input.mobileImage) } });
  await invalidateBannerCache();
  return banner;
}

export async function updateBanner(id: string, input: UpdateBannerInput) {
  const existing = await db.banner.findUnique({ where: { id } });
  if (!existing) throw new BannerNotFoundError(id);

  const data: Prisma.BannerUpdateInput = { link: input.link, order: input.order, isActive: input.isActive, image: input.image };
  if (input.mobileImage !== undefined) data.mobileImage = toJsonInput(input.mobileImage);

  const banner = await db.banner.update({ where: { id }, data });
  await invalidateBannerCache();
  return banner;
}

export async function deleteBanner(id: string) {
  const existing = await db.banner.findUnique({ where: { id } });
  if (!existing) throw new BannerNotFoundError(id);

  await db.banner.delete({ where: { id } });
  await invalidateBannerCache();
}
