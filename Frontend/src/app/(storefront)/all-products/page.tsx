import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { SITE_URL, PURPOSES, CAMPAIGN_PAGE_SLUGS } from '@/lib/constants';
import type { PaginatedProducts, Product } from '@/types/api.types';

const TITLE = 'All Products — Complete Doshmukti Catalogue';
const DESCRIPTION =
  'Every Doshmukti gemstone, rudraksha, bracelet, yantra and pooja product in one list, grouped by purpose — love, wealth, health, success, protection and clarity.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/all-products' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/all-products`, type: 'website' },
};

// Hourly ISR — same window as sitemap.ts, so a new product shows up here and in the sitemap together.
export const revalidate = 3600;

// Backend caps `limit` at 100 (products/schema.ts).
const PAGE_LIMIT = 100;

// A plain server-rendered <a href> to every product. /shop paginates and loads client-side, so
// most PDPs had no crawlable link from any indexed page — Google "discovered" them from the
// sitemap only, and sat on them (Search Console: "Discovered – currently not indexed").
// This page + the footer link give every PDP a 2-click path from every page on the site.
async function getAllProducts(): Promise<Product[]> {
  const all: Product[] = [];
  let page = 1;
  while (true) {
    let data: PaginatedProducts;
    try {
      data = await api.get<PaginatedProducts>(`/api/products?limit=${PAGE_LIMIT}&page=${page}`, undefined, revalidate);
    } catch {
      break;
    }
    all.push(...data.products);
    if (page >= data.pages) break;
    page += 1;
  }
  return all;
}

// Campaign pages are the canonical URL for their product (see CAMPAIGN_PAGE_SLUGS) — link there.
function productHref(slug: string): string {
  return CAMPAIGN_PAGE_SLUGS[slug] ?? `/products/${slug}`;
}

export default async function AllProductsPage() {
  const products = await getAllProducts();

  const groups = PURPOSES.map((p) => ({
    ...p,
    items: products.filter((prod) => prod.purpose.includes(p.id)),
  })).filter((g) => g.items.length > 0);

  const placed = new Set(groups.flatMap((g) => g.items.map((i) => i.slug)));
  const others = products.filter((p) => !placed.has(p.slug));

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[#2B1B0C] mb-3">All Doshmukti Products</h1>
      <p className="font-body text-sm sm:text-base text-[#6B5539] mb-10 max-w-2xl">
        {products.length} gemstones, rudraksha, bracelets, yantras and pooja products — grouped by what you want them to
        help with. Not sure which to pick? <Link href="/faq" className="underline">Read the FAQ</Link> or{' '}
        <Link href="/contact" className="underline">ask Acharya Madhav</Link>.
      </p>

      {groups.map((g) => (
        <section key={g.id} className="mb-10">
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#2B1B0C] mb-1">{g.label}</h2>
          <p className="font-body text-xs sm:text-sm text-[#8A7A63] mb-3">{g.description}</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 font-body text-sm">
            {g.items.map((prod) => (
              <li key={prod.slug}>
                <Link href={productHref(prod.slug)} className="text-[#9C5A26] hover:text-[#2B1B0C] underline-offset-2 hover:underline">
                  {prod.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {others.length > 0 && (
        <section className="mb-10">
          <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#2B1B0C] mb-3">More Products</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 font-body text-sm">
            {others.map((prod) => (
              <li key={prod.slug}>
                <Link href={productHref(prod.slug)} className="text-[#9C5A26] hover:text-[#2B1B0C] underline-offset-2 hover:underline">
                  {prod.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="font-body text-sm text-[#6B5539]">
        <Link href="/shop" className="underline">Browse with filters in the shop</Link> ·{' '}
        <Link href="/about" className="underline">About Doshmukti</Link> ·{' '}
        <Link href="/" className="underline">Home</Link>
      </p>
    </main>
  );
}
