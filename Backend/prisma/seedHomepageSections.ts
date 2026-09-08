// Backfills the 4 homepage rails that were previously hardcoded in
// Frontend/src/app/(storefront)/page.tsx (Handpicked This Week, Doshmukti Special,
// Rudraksha, Bracelets) into the new HomepageSection/HomepageSectionItem tables,
// so the switch to the admin-controlled `/homepage-sections` endpoint doesn't
// regress the homepage on deploy. Idempotent — upserts by `key`, safe to re-run.
//
// Independent of `db:seed` (that one replaces the whole dev catalog) — run this
// once, standalone, after `prisma migrate deploy` on a real deploy:
//   npm run db:seed-homepage
import { PrismaClient, type Prisma } from '@prisma/client';

const db = new PrismaClient();

interface SectionSeed {
  key: string;
  title: string;
  order: number;
  where: Prisma.ProductWhereInput;
}

// Category string literals below are copied verbatim from
// Frontend/src/app/(storefront)/page.tsx's getCategory(...) calls — NOT guessed.
const SECTIONS: SectionSeed[] = [
  {
    key: 'handpicked-this-week',
    title: 'Handpicked This Week',
    order: 0,
    where: { status: 'ACTIVE', featured: true },
  },
  {
    key: 'doshmukti-special',
    title: 'Doshmukti Special',
    order: 1,
    where: { status: 'ACTIVE', categories: { has: 'DoshMukti Special' } },
  },
  {
    key: 'rudraksha',
    title: 'Rudraksha',
    order: 2,
    where: { status: 'ACTIVE', categories: { has: 'Rudraksha / Kada' } },
  },
  {
    key: 'bracelets',
    title: 'Bracelets',
    order: 3,
    where: { status: 'ACTIVE', categories: { has: 'Bracelets' } },
  },
];

async function main() {
  for (const seed of SECTIONS) {
    const existing = await db.homepageSection.findUnique({ where: { key: seed.key } });
    if (existing) {
      console.log(`skip: section "${seed.key}" already exists`);
      continue;
    }

    const products = await db.product.findMany({
      where: seed.where,
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true },
    });

    await db.homepageSection.create({
      data: {
        key: seed.key,
        title: seed.title,
        order: seed.order,
        isActive: true,
        items: {
          create: products.map((p, index) => ({ productId: p.id, order: index })),
        },
      },
    });

    console.log(`created: section "${seed.key}" with ${products.length} product(s)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
