import { logger } from '../shared/logger/pino';
import { getActiveHomepageSections } from '../modules/homepage-sections/service';
import { getActiveBanners } from '../modules/banners/service';
import { getDistinctCategories, getCategoryThumbnails, getFeaturedProducts } from '../modules/products/service';

// Repopulates every Redis-cached public response the homepage depends on, so the first
// real visitor after a deploy (or after a TTL expiry) never pays the cold-cache DB hit —
// each of these functions already writes through to Redis internally on a cache miss,
// this just triggers that write proactively instead of waiting for live traffic to. Hit
// by Cloud Scheduler on a short interval (shorter than the shortest TTL involved, so a
// slot never actually goes cold) and once right after each deploy.
export async function warmCache(): Promise<{ warmed: string[]; failed: string[] }> {
  const targets: Array<[string, () => Promise<unknown>]> = [
    ['homepage-sections', () => getActiveHomepageSections()],
    ['banners', () => getActiveBanners()],
    ['categories', () => getDistinctCategories()],
    ['category-thumbnails', () => getCategoryThumbnails()],
    ['featured-products', () => getFeaturedProducts(12)],
  ];

  const warmed: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    targets.map(async ([name, fn]) => {
      try {
        await fn();
        warmed.push(name);
      } catch (err) {
        failed.push(name);
        logger.error({ err, target: name }, 'warmCache target failed');
      }
    })
  );

  return { warmed, failed };
}
