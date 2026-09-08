// The R2 bucket migration rewrote Banner/Product image URLs via raw SQL, bypassing the
// service-layer cache invalidation (invalidateBannerCache / invalidateProductCaches are only
// called from create/update/delete mutations, never triggered by a direct SQL UPDATE). Redis
// kept serving the pre-migration banners/products/homepage-sections with old R2 URLs baked in
// until each key's TTL expired. This deletes every affected key, then re-warms them so the
// site is correct immediately instead of waiting out the TTL.
import { redis } from '../src/shared/cache/client';
import { warmCache } from '../src/jobs/warm-cache';

async function main() {
  const patterns = ['products:*', 'product:*', 'banners:*', 'homepage:*'];
  let deleted = 0;
  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);
    await Promise.all(keys.map((k) => redis.del(k)));
    deleted += keys.length;
    console.log(`deleted ${keys.length} key(s) matching "${pattern}"`);
  }
  console.log(`total deleted: ${deleted}`);

  const { warmed, failed } = await warmCache();
  console.log(`re-warmed: ${warmed.join(', ')}`);
  if (failed.length > 0) console.log(`FAILED to re-warm: ${failed.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
