// One-time media migration: copy only the R2 objects the database actually references
// from the old shared bucket into the new dedicated bucket, then rewrite every stored URL
// to point at the new bucket's public domain.
//
// IMPORTANT: the source bucket ("test") is a shared personal bucket with 8000+ unrelated
// objects (college files, random videos, memes, ~9GB total) — NOT a dedicated app bucket.
// This script does NOT copy the whole bucket. It scans the live DB for every URL under
// SOURCE_R2_PUBLIC_URL, builds a manifest of just those keys, and copies only that set.
// Anything in the DB that isn't actually an R2 URL (picsum placeholders, doshmukti.com
// category links) is left untouched.
//
// Usage (PowerShell), run from Backend/:
//   $env:TARGET_R2_ACCOUNT_ID = "..."
//   $env:TARGET_R2_ACCESS_KEY_ID = "..."
//   $env:TARGET_R2_SECRET_ACCESS_KEY = "..."
//   $env:TARGET_R2_BUCKET_NAME = "..."
//   $env:TARGET_R2_PUBLIC_URL = "https://..."
//   node --env-file=.env scripts/migrate-r2-bucket.mjs --dry-run   # manifest only, no writes
//   node --env-file=.env scripts/migrate-r2-bucket.mjs             # copy objects + rewrite DB URLs
//
// SOURCE_R2_* defaults to the current R2_* values already in .env (the old bucket).
// DATABASE_URL is read from .env (the live DB — copy/rewrite happens against whatever
// DATABASE_URL currently points to).

import { PrismaClient } from '@prisma/client';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = 8;

const SOURCE_R2_ACCOUNT_ID = process.env.SOURCE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const SOURCE_R2_ACCESS_KEY_ID = process.env.SOURCE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const SOURCE_R2_SECRET_ACCESS_KEY = process.env.SOURCE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
const SOURCE_R2_BUCKET_NAME = process.env.SOURCE_R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
const SOURCE_R2_PUBLIC_URL = (process.env.SOURCE_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const TARGET_R2_ACCOUNT_ID = process.env.TARGET_R2_ACCOUNT_ID;
const TARGET_R2_ACCESS_KEY_ID = process.env.TARGET_R2_ACCESS_KEY_ID;
const TARGET_R2_SECRET_ACCESS_KEY = process.env.TARGET_R2_SECRET_ACCESS_KEY;
const TARGET_R2_BUCKET_NAME = process.env.TARGET_R2_BUCKET_NAME;
const TARGET_R2_PUBLIC_URL = (process.env.TARGET_R2_PUBLIC_URL || '').replace(/\/$/, '');

for (const [name, val] of Object.entries({
  SOURCE_R2_ACCOUNT_ID, SOURCE_R2_ACCESS_KEY_ID, SOURCE_R2_SECRET_ACCESS_KEY, SOURCE_R2_BUCKET_NAME, SOURCE_R2_PUBLIC_URL,
  TARGET_R2_ACCOUNT_ID, TARGET_R2_ACCESS_KEY_ID, TARGET_R2_SECRET_ACCESS_KEY, TARGET_R2_BUCKET_NAME, TARGET_R2_PUBLIC_URL,
})) {
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const source = new S3Client({
  region: 'auto',
  endpoint: `https://${SOURCE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: SOURCE_R2_ACCESS_KEY_ID, secretAccessKey: SOURCE_R2_SECRET_ACCESS_KEY },
});
const target = new S3Client({
  region: 'auto',
  endpoint: `https://${TARGET_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: TARGET_R2_ACCESS_KEY_ID, secretAccessKey: TARGET_R2_SECRET_ACCESS_KEY },
});

function log(msg) {
  console.log(`[r2-migrate] ${msg}`);
}

// ── Phase 1: build the manifest by scanning every JSON/text field that can hold a URL ──
const urlPattern = /https?:\/\/[^\s"'\\]+/g;
function collectUrls(value, into) {
  if (value == null) return;
  if (typeof value === 'string') {
    const matches = value.match(urlPattern);
    if (matches) matches.forEach((m) => into.add(m));
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectUrls(v, into));
  } else if (typeof value === 'object') {
    Object.values(value).forEach((v) => collectUrls(v, into));
  }
}

async function buildManifest() {
  const urls = new Set();

  const products = await db.product.findMany({
    select: {
      images: true, description: true, testimonialVideos: true,
      howToUseVideoUrl: true, benefits: true, howToWear: true,
    },
  });
  products.forEach((p) => collectUrls(p, urls));

  const banners = await db.banner.findMany({ select: { image: true, mobileImage: true } });
  banners.forEach((b) => collectUrls(b, urls));

  const reviews = await db.review.findMany({ select: { body: true } });
  reviews.forEach((r) => collectUrls(r, urls));

  const keys = new Set();
  for (const url of urls) {
    if (url.startsWith(SOURCE_R2_PUBLIC_URL + '/')) {
      // URLs are percent-encoded (e.g. "%20" for a space) but S3 object keys are not —
      // decode before using the key in any GetObject/PutObject call.
      keys.add(decodeURIComponent(url.slice(SOURCE_R2_PUBLIC_URL.length + 1)));
    }
  }
  return keys;
}

async function copyObject(key) {
  const got = await source.send(new GetObjectCommand({ Bucket: SOURCE_R2_BUCKET_NAME, Key: key }));
  const body = await got.Body.transformToByteArray();
  await target.send(
    new PutObjectCommand({
      Bucket: TARGET_R2_BUCKET_NAME,
      Key: key,
      Body: Buffer.from(body),
      ContentType: got.ContentType,
      CacheControl: got.CacheControl,
    })
  );
}

async function runPool(items, worker, concurrency) {
  const results = [];
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      try {
        await worker(items[idx]);
        results.push({ item: items[idx], ok: true });
      } catch (err) {
        results.push({ item: items[idx], ok: false, error: err.message });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

async function main() {
  log(`mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  log(`source: bucket="${SOURCE_R2_BUCKET_NAME}" publicUrl="${SOURCE_R2_PUBLIC_URL}"`);
  log(`target: bucket="${TARGET_R2_BUCKET_NAME}" publicUrl="${TARGET_R2_PUBLIC_URL}"`);

  const manifest = await buildManifest();
  log(`manifest: ${manifest.size} object(s) actually referenced by the DB`);

  if (DRY_RUN) {
    const results = await runPool(
      [...manifest],
      (key) => source.send(new HeadObjectCommand({ Bucket: SOURCE_R2_BUCKET_NAME, Key: key })),
      CONCURRENCY
    );
    const missing = results.filter((r) => !r.ok);
    missing.forEach((m) => log(`  MISSING in source bucket: ${m.item}`));
    log(`(dry run) checked ${results.length} keys, ${missing.length} missing from source bucket`);
    return;
  }

  const results = await runPool([...manifest], copyObject, CONCURRENCY);
  const failed = results.filter((r) => !r.ok);
  const ok = results.filter((r) => r.ok);
  log(`copied ${ok.length}/${manifest.size} object(s)`);
  if (failed.length > 0) {
    log(`FAILED (${failed.length}) — not rewriting DB URLs for these, left pointing at old bucket:`);
    failed.forEach((f) => log(`  ${f.item}: ${f.error}`));
  }

  // ── Phase 2: rewrite stored URLs, column by column ──────────────────────────
  const from = SOURCE_R2_PUBLIC_URL;
  const to = TARGET_R2_PUBLIC_URL;

  const updates = [
    db.$executeRawUnsafe(
      `UPDATE "Product" SET images = replace(images::text, $1, $2)::jsonb WHERE images::text LIKE '%' || $1 || '%'`,
      from, to
    ),
    db.$executeRawUnsafe(
      `UPDATE "Product" SET description = replace(description::text, $1, $2)::jsonb WHERE description::text LIKE '%' || $1 || '%'`,
      from, to
    ),
    db.$executeRawUnsafe(
      `UPDATE "Product" SET "testimonialVideos" = replace("testimonialVideos"::text, $1, $2)::jsonb WHERE "testimonialVideos"::text LIKE '%' || $1 || '%'`,
      from, to
    ),
    db.$executeRawUnsafe(
      `UPDATE "Product" SET benefits = replace(benefits::text, $1, $2)::jsonb WHERE benefits::text LIKE '%' || $1 || '%'`,
      from, to
    ),
    db.$executeRawUnsafe(
      `UPDATE "Product" SET "howToWear" = replace("howToWear"::text, $1, $2)::jsonb WHERE "howToWear"::text LIKE '%' || $1 || '%'`,
      from, to
    ),
    db.$executeRawUnsafe(
      `UPDATE "Product" SET "howToUseVideoUrl" = replace("howToUseVideoUrl", $1, $2) WHERE "howToUseVideoUrl" LIKE '%' || $1 || '%'`,
      from, to
    ),
    db.$executeRawUnsafe(
      `UPDATE "Banner" SET image = replace(image::text, $1, $2)::jsonb WHERE image::text LIKE '%' || $1 || '%'`,
      from, to
    ),
    db.$executeRawUnsafe(
      `UPDATE "Banner" SET "mobileImage" = replace("mobileImage"::text, $1, $2)::jsonb WHERE "mobileImage" IS NOT NULL AND "mobileImage"::text LIKE '%' || $1 || '%'`,
      from, to
    ),
    db.$executeRawUnsafe(
      `UPDATE "Review" SET body = replace(body, $1, $2) WHERE body LIKE '%' || $1 || '%'`,
      from, to
    ),
  ];

  const labels = [
    'Product.images', 'Product.description', 'Product.testimonialVideos', 'Product.benefits',
    'Product.howToWear', 'Product.howToUseVideoUrl', 'Banner.image', 'Banner.mobileImage', 'Review.body',
  ];
  const counts = await Promise.all(updates);
  counts.forEach((c, i) => log(`  ${labels[i]}: ${c} row(s) updated`));

  log('done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
