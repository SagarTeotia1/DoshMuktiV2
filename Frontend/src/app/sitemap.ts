import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';
import { api } from '@/lib/api-client';
import type { PaginatedProducts } from '@/types/api.types';

// Without this, Next.js treats sitemap.ts as fully static — generated once at `next
// build` and frozen forever. The product fetch below failing even once during a build
// (Backend unreachable from the build environment, catalog not seeded yet, etc) meant
// every product page silently vanished from the live sitemap with no way to recover
// short of a full rebuild — which is exactly what happened: the deployed sitemap had
// zero /products/* URLs despite the catalog being live. Revalidating hourly means a
// bad build self-heals on its own instead of staying broken indefinitely.
export const revalidate = 3600;

const STATIC_ROUTES = [
  '',
  '/shop',
  '/about',
  '/contact',
  '/faq',
  '/privacy',
  '/terms',
  '/all-products',
];

// One-product campaign pages (outside the (storefront) group). Each calls notFound() when
// its product is missing from the catalog, so listing one here without checking made the
// sitemap advertise a live 404 (vahan-suraksha-kavach) — only emit it if the slug exists.
const CAMPAIGN_SLUGS = [
  'durghatna-nashak-yantra',
  'durbhagya-nashak-nariyal',
  'divya-hawan-powder',
  'ghoda-ki-naal',
  'rose-quartz-bracelet',
];

// Backend caps `limit` at 100 (products/schema.ts) — requesting more 400s. A prior
// version requested limit=500 in one shot; the 400 was swallowed by the catch below
// and silently produced an empty product sitemap for months. Paginate at the real cap.
const BACKEND_PAGE_LIMIT = 100;

async function getAllProductSlugs(): Promise<Array<{ slug: string; updatedAt?: string }>> {
  const slugs: Array<{ slug: string; updatedAt?: string }> = [];
  let page = 1;

  while (true) {
    let data: PaginatedProducts;
    try {
      data = await api.get<PaginatedProducts>(`/api/products?limit=${BACKEND_PAGE_LIMIT}&page=${page}`, undefined, 3600);
    } catch (err) {
      console.error(`sitemap: failed to fetch products page ${page}`, err);
      break;
    }
    slugs.push(...data.products.map((p) => ({ slug: p.slug, updatedAt: (p as { updatedAt?: string }).updatedAt })));
    if (page >= data.pages) break;
    page += 1;
  }

  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProductSlugs();
  const productSlugs = new Set(products.map((p) => p.slug));

  // No lastModified on static pages: stamping "now" on every regen teaches Google to
  // ignore the sitemap's dates. Only products carry a real updatedAt.
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));

  const campaignEntries: MetadataRoute.Sitemap = CAMPAIGN_SLUGS.filter((slug) => productSlugs.has(slug)).map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  // /shop?purpose=… URLs are deliberately not listed: parameter variants of /shop get
  // treated as duplicates and waste crawl budget on a brand-new domain.
  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  return [...staticEntries, ...campaignEntries, ...productEntries];
}
