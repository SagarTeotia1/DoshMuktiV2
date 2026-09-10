import type { MetadataRoute } from 'next';
import { SITE_URL, PURPOSES } from '@/lib/constants';
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

const STATIC_ROUTES = ['', '/shop', '/about', '/contact', '/faq', '/privacy', '/terms'];

// Backend caps `limit` at 100 (products/schema.ts) — requesting more 400s. A prior
// version requested limit=500 in one shot; the 400 was swallowed by the catch below
// and silently produced an empty product sitemap for months. Paginate at the real cap.
const BACKEND_PAGE_LIMIT = 100;

async function getAllProductSlugs(): Promise<Array<{ slug: string }>> {
  const slugs: Array<{ slug: string }> = [];
  let page = 1;

  while (true) {
    let data: PaginatedProducts;
    try {
      data = await api.get<PaginatedProducts>(`/api/products?limit=${BACKEND_PAGE_LIMIT}&page=${page}`, undefined, 3600);
    } catch (err) {
      console.error(`sitemap: failed to fetch products page ${page}`, err);
      break;
    }
    slugs.push(...data.products.map((p) => ({ slug: p.slug })));
    if (page >= data.pages) break;
    page += 1;
  }

  return slugs;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProductSlugs();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));

  const purposeEntries: MetadataRoute.Sitemap = PURPOSES.map((p) => ({
    url: `${SITE_URL}/shop?purpose=${p.id}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  return [...staticEntries, ...purposeEntries, ...productEntries];
}
