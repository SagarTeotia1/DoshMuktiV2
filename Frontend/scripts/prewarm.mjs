#!/usr/bin/env node
// Warms the site's caches after a deploy: requests every URL in the sitemap (fills Next's ISR
// cache and any CDN in front), then the optimized product images those pages use, so the first
// real visitor gets a cache HIT instead of paying for a render.
//
//   node scripts/prewarm.mjs https://doshmukti.com
//   npm run prewarm -- https://doshmukti.com
//
// Env: PREWARM_CONCURRENCY (default 6), PREWARM_IMAGES=0 to skip image warming.

const base = (process.argv[2] ?? process.env.SITE_URL ?? '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: node scripts/prewarm.mjs <site-url>');
  process.exit(1);
}

const concurrency = Number(process.env.PREWARM_CONCURRENCY ?? 6);
const warmImages = process.env.PREWARM_IMAGES !== '0';
// Same widths the storefront's next/image requests use on phones and laptops.
const IMAGE_WIDTHS = [384, 640, 828];

async function pool(items, worker) {
  const queue = [...items];
  const results = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) results.push(await worker(queue.shift()));
    }),
  );
  return results;
}

async function hit(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { 'user-agent': 'doshmukti-prewarm' } });
    await res.arrayBuffer();
    return { url, status: res.status, ms: Date.now() - started, cache: res.headers.get('x-nextjs-cache') ?? res.headers.get('cf-cache-status') ?? '-' };
  } catch (err) {
    return { url, status: 0, ms: Date.now() - started, cache: String(err.message ?? err) };
  }
}

const sitemapXml = await (await fetch(`${base}/sitemap.xml`)).text();
// The sitemap lists the configured SITE_URL; re-point to the host we're warming so this also
// works against a staging URL.
const pageUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => {
  const { pathname, search } = new URL(loc);
  return `${base}${pathname}${search}`;
});
const imageSrcs = warmImages ? [...new Set([...sitemapXml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(([, src]) => src))] : [];

console.log(`Warming ${pageUrls.length} pages${imageSrcs.length ? ` and ${imageSrcs.length} images x ${IMAGE_WIDTHS.length} sizes` : ''} on ${base}`);

const pages = await pool(pageUrls, hit);
const images = await pool(
  imageSrcs.flatMap((src) => IMAGE_WIDTHS.map((w) => `${base}/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`)),
  hit,
);

const failed = [...pages, ...images].filter((r) => r.status === 0 || r.status >= 400);
const avg = (rs) => (rs.length ? Math.round(rs.reduce((a, r) => a + r.ms, 0) / rs.length) : 0);
console.log(`Pages: ${pages.length - failed.filter((f) => pages.includes(f)).length}/${pages.length} ok, avg ${avg(pages)}ms`);
if (images.length) console.log(`Images: ${images.length - failed.filter((f) => images.includes(f)).length}/${images.length} ok, avg ${avg(images)}ms`);
for (const f of failed.slice(0, 15)) console.log(`  FAIL ${f.status} ${f.url} (${f.cache})`);
process.exit(failed.length ? 1 : 0);
