// One-time data migration: copy the current Neon DB into a fresh Neon DB, keeping
// catalog/content data (products, variants, offers, banners, homepage sections, reviews,
// coupons, reward points, addresses, book chunks) byte-for-byte, but:
//   - User table: only rows whose name matches TEST_USER_NAME_MATCH (default "test") survive.
//   - Order / OrderItem / OrderStatusLog / Payment / Shipment / OrderSequence: not copied at all.
//   - OtpVerification: not copied (transient login-OTP session state, not "data").
//   - ProductVariant.stockQuantity: restored on the target by adding back the quantity of
//     every deleted OrderItem, EXCEPT pairs whose stock was already returned via a
//     RESERVATION_RELEASED StockMovement (checked by orderId+variantId, to avoid double-adding).
//     Checkout deducts stockQuantity directly at order-creation time with no ledger row for
//     the deduction itself (only releases are logged) — there is no "SALE" movement to reverse.
//     StockMovement rows themselves ARE copied unchanged (append-only ledger, never edited).
//
// Nothing here ever writes to the source database — it is read-only for the whole run.
//
// NOT SAFE TO RE-RUN once the target has data: createMany/skipDuplicates makes the catalog
// copy harmless to repeat, but the inventory-restore step (Phase 4) is NOT idempotent — it
// will add the same "stock held by deleted orders" quantity back a second time. If a later
// `git pull` brings a schema-only change (new migration, no new source orders/products), do
// NOT rerun this whole script — instead just `prisma migrate deploy` against the target
// (DATABASE_URL/DIRECT_URL pointed at it) and manually sync any changed rows by hand.
//
// Usage (PowerShell), run from Backend/:
//   $env:SOURCE_DATABASE_URL = "<current DATABASE_URL from .env>"
//   $env:TARGET_DATABASE_URL = "<new Neon connection string>"
//   node scripts/migrate-to-new-db.mjs --dry-run     # inspect counts, writes nothing
//   node scripts/migrate-to-new-db.mjs               # actually migrate
//
// Optional env vars:
//   TEST_USER_NAME_MATCH  - substring to match against User.name, case-insensitive (default "test")
//   TARGET_DIRECT_URL     - unpooled connection string for the target, used only to run
//                           `prisma migrate deploy` (needed for CREATE EXTENSION/DDL). If
//                           omitted, it's derived from TARGET_DATABASE_URL by stripping "-pooler".
//   FORCE=1               - skip the "target must be empty" safety check

import { PrismaClient, Prisma } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.env.FORCE === '1';
const TEST_USER_NAME_MATCH = process.env.TEST_USER_NAME_MATCH || 'test';

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;
if (!SOURCE_URL || !TARGET_URL) {
  console.error('SOURCE_DATABASE_URL and TARGET_DATABASE_URL must both be set.');
  process.exit(1);
}
const TARGET_DIRECT_URL = process.env.TARGET_DIRECT_URL || TARGET_URL.replace('-pooler.', '.');

const source = new PrismaClient({ datasourceUrl: SOURCE_URL });
const target = new PrismaClient({ datasourceUrl: TARGET_URL });

function log(msg) {
  console.log(`[migrate] ${msg}`);
}

async function copyTable(name, { findArgs = {}, model = name[0].toLowerCase() + name.slice(1) } = {}) {
  const rows = await source[model].findMany(findArgs);
  log(`${name}: ${rows.length} row(s) read from source`);
  if (!DRY_RUN && rows.length > 0) {
    await target[model].createMany({ data: rows, skipDuplicates: true });
  }
  return rows.length;
}

async function copyBookChunks() {
  const rows = await source.$queryRaw`
    SELECT id, source, content, "createdAt", embedding::text AS embedding
    FROM "BookChunk"
  `;
  log(`BookChunk: ${rows.length} row(s) read from source`);
  if (DRY_RUN) return rows.length;
  for (const row of rows) {
    if (row.embedding) {
      await target.$executeRaw`
        INSERT INTO "BookChunk" (id, source, content, "createdAt", embedding)
        VALUES (${row.id}, ${row.source}, ${row.content}, ${row.createdAt}, ${Prisma.raw(`'${row.embedding}'::vector`)})
      `;
    } else {
      await target.$executeRaw`
        INSERT INTO "BookChunk" (id, source, content, "createdAt", embedding)
        VALUES (${row.id}, ${row.source}, ${row.content}, ${row.createdAt}, NULL)
      `;
    }
  }
  return rows.length;
}

async function copyOfferProductsJoin() {
  const rows = await source.$queryRaw`SELECT "A", "B" FROM "_OfferProducts"`;
  log(`_OfferProducts (Offer<->Product): ${rows.length} row(s) read from source`);
  if (!DRY_RUN) {
    for (const row of rows) {
      await target.$executeRaw`INSERT INTO "_OfferProducts" ("A", "B") VALUES (${row.A}, ${row.B})`;
    }
  }
  return rows.length;
}

async function main() {
  log(`mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  log(`test-user filter: User.name ILIKE '%${TEST_USER_NAME_MATCH}%'`);

  // ── Safety check ──────────────────────────────────────────────────────────
  let existingProducts = 0;
  try {
    existingProducts = await target.product.count();
  } catch (err) {
    if (err.code !== 'P2021') throw err; // P2021 = table doesn't exist yet — fresh target DB, fine
    log('target DB has no schema yet (fresh database) — will create it via prisma migrate deploy');
  }
  if (existingProducts > 0 && !FORCE) {
    console.error(
      `Target DB already has ${existingProducts} product(s). Refusing to run against a ` +
        `non-empty target (would double-insert). Set FORCE=1 if you really mean to continue.`
    );
    process.exit(1);
  }

  // ── Phase 0: create schema on target (tables, enums, pgvector extension) ──
  if (!DRY_RUN) {
    log('running `prisma migrate deploy` against target DB...');
    const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: backendRoot,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: TARGET_URL,
        DIRECT_URL: TARGET_DIRECT_URL,
      },
    });
    if (result.status !== 0) {
      console.error('prisma migrate deploy failed against target DB — aborting before any data copy.');
      process.exit(1);
    }
  } else {
    log('(dry run) would run `prisma migrate deploy` against target DB here');
  }

  // ── Phase 1: catalog / content tables, in FK-safe order ────────────────────
  await copyTable('Coupon');
  await copyTable('Product');
  await copyTable('ProductVariant');
  await copyTable('StockMovement');
  await copyTable('Offer');
  await copyOfferProductsJoin();
  await copyTable('CustomerAddress');
  await copyTable('RewardPoint');
  await copyTable('Review');
  await copyTable('Banner');
  await copyTable('HomepageSection');
  await copyTable('HomepageSectionItem');
  await copyBookChunks();

  // ── Phase 2: User, filtered to test accounts only ──────────────────────────
  const testUserCount = await copyTable('User', {
    findArgs: { where: { name: { contains: TEST_USER_NAME_MATCH, mode: 'insensitive' } } },
  });

  // ── Phase 3: explicitly-skipped tables (order data + OTP state) — report only
  const skipped = {
    Order: await source.order.count(),
    OrderItem: await source.orderItem.count(),
    OrderStatusLog: await source.orderStatusLog.count(),
    Payment: await source.payment.count(),
    Shipment: await source.shipment.count(),
    OrderSequence: await source.orderSequence.count(),
    OtpVerification: await source.otpVerification.count(),
    'User (non-test, dropped)': (await source.user.count()) - testUserCount,
  };
  log(`Skipped (not copied to target): ${JSON.stringify(skipped)}`);

  // ── Phase 4: restore inventory — add back every deleted order's held stock ──
  const released = await source.stockMovement.findMany({
    where: { reason: 'RESERVATION_RELEASED' },
    select: { orderId: true, variantId: true },
  });
  const releasedSet = new Set(released.map((r) => `${r.orderId}:${r.variantId}`));

  const orderItems = await source.orderItem.findMany({
    select: { orderId: true, variantId: true, quantity: true },
  });
  const restoreByVariant = new Map();
  for (const item of orderItems) {
    if (releasedSet.has(`${item.orderId}:${item.variantId}`)) continue; // already returned to stock, don't double-add
    restoreByVariant.set(item.variantId, (restoreByVariant.get(item.variantId) ?? 0) + item.quantity);
  }
  log(`restoring stock for ${restoreByVariant.size} variant(s) held by deleted orders`);
  for (const [variantId, qty] of restoreByVariant) {
    log(`  ${variantId}: +${qty}`);
    if (!DRY_RUN) {
      await target.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: { increment: qty } },
      });
    }
  }

  // ── Phase 5: verification summary ──────────────────────────────────────────
  if (!DRY_RUN) {
    const counts = {};
    for (const m of [
      'coupon', 'product', 'productVariant', 'stockMovement', 'offer',
      'customerAddress', 'rewardPoint', 'review', 'banner',
      'homepageSection', 'homepageSectionItem', 'bookChunk', 'user',
    ]) {
      counts[m] = await target[m].count();
    }
    log(`Target row counts: ${JSON.stringify(counts, null, 2)}`);
  }

  log('done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
