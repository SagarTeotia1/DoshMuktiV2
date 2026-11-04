import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ImpressionTracker } from '@/components/storefront/ImpressionTracker';
import { ShopFilters } from './shop-filters';
import { ShopToolbar } from './shop-toolbar';
import { ShopPagination } from './shop-pagination';
import { OrnamentDivider } from '@/components/motion/OrnamentDivider';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { api } from '@/lib/api-client';
import { PURPOSES, SITE_URL, type PurposeId } from '@/lib/constants';
import type { PaginatedProducts } from '@/types/api.types';

type ShopSearchParams = {
  purpose?: string;
  category?: string;
  q?: string;
  featured?: string;
  sort?: string;
  page?: string;
};

// Purpose-filtered shop URLs are the highest-intent SEO/AEO surface on the site
// ("gemstones for wealth", "bracelet for love") — give each one its own title/
// description instead of every /shop?purpose=X sharing the generic catalog copy.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}): Promise<Metadata> {
  const { purpose, category, q, sort, page } = await searchParams;
  const match = PURPOSES.find((p) => p.id === (purpose as PurposeId));

  const title = match
    ? `${match.label} — Gemstones & Remedies`
    : category
      ? `${category} — Authentic Astrology Products`
      : 'Shop All Products';
  const description = match
    ? `${match.description}. Authentic, energized gemstones, rudraksha and bracelets chosen with Vedic astrology guidance — shop the full ${match.label.toLowerCase()} collection.`
    : category
      ? `Shop ${category} at Doshmukti — authentic, verified and energized, chosen with Vedic astrology guidance. Insured delivery across India and 7-day returns on eligible orders.`
      : 'Browse the full Doshmukti collection — gemstones, rudraksha malas, bracelets and pooja accessories for love, wealth, health, success, protection and clarity.';
  const canonical = match ? `/shop?purpose=${match.id}` : category ? `/shop?category=${encodeURIComponent(category)}` : '/shop';

  // Internal search results, re-sorted views and deep pages are thin/duplicate content: keep them
  // crawlable for link discovery but out of the index.
  const thinView = Boolean(q) || Boolean(sort) || (page !== undefined && page !== '1');

  return {
    title,
    description,
    alternates: { canonical },
    ...(thinView ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title, description, url: `${SITE_URL}${canonical}`, type: 'website' },
  };
}

async function getProducts(sp: ShopSearchParams) {
  const params = new URLSearchParams();
  if (sp.purpose) params.set('purpose', sp.purpose);
  if (sp.category) params.set('category', sp.category);
  if (sp.q) params.set('q', sp.q);
  if (sp.featured) params.set('featured', sp.featured);
  if (sp.sort) params.set('sort', sp.sort);
  if (sp.page) params.set('page', sp.page);
  params.set('limit', '24');

  try {
    return await api.get<PaginatedProducts>(`/api/products?${params.toString()}`);
  } catch {
    return { products: [], total: 0, pages: 0, page: 1 };
  }
}

async function getCategoryThumbs(): Promise<Array<{ id: string; label: string; image: string | null }>> {
  try {
    return await api.get<Array<{ id: string; label: string; image: string | null }>>('/api/products/category-thumbs');
  } catch {
    return [];
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const sp = await searchParams;
  const [data, categoryThumbs] = await Promise.all([getProducts(sp), getCategoryThumbs()]);

  const purposeMatch = PURPOSES.find((p) => p.id === (sp.purpose as PurposeId));
  const heading = sp.q
    ? `Results for "${sp.q}"`
    : sp.category
      ? sp.category
      : purposeMatch
        ? purposeMatch.label
        : sp.featured
          ? 'Featured Pieces'
          : 'Our Collection';
  const blurb = sp.q
    ? 'Everything that matches your search.'
    : purposeMatch
      ? purposeMatch.description
      : 'Gemstones, rudraksha and bracelets, verified and energized with Vedic guidance.';
  const [headFirst, ...headRest] = heading.split(' ');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pb-6 sm:pb-8">
      <header className="relative px-2 pb-5 pt-10 text-center sm:pb-8 sm:pt-16">
        <MandalaMotif className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 text-[#9C5A26]/[0.08] sm:h-96 sm:w-96" />
        <h1 className="relative font-heading text-[2.5rem] leading-[1.05] tracking-tight text-[#2B1B0C] sm:text-6xl md:text-7xl">
          <span className="font-black">{headFirst}</span>
          {headRest.length > 0 && <span className="font-light italic text-[#9C5A26]"> {headRest.join(' ')}</span>}
        </h1>
        <p className="relative mx-auto mt-3 max-w-md font-body text-sm text-[#5C4A33] sm:mt-4 sm:text-base">{blurb}</p>
        <OrnamentDivider className="relative mt-3 sm:mt-4" />
      </header>

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <div className="hidden lg:block lg:w-56 flex-shrink-0">
        <Suspense>
          <ShopFilters categories={categoryThumbs} />
        </Suspense>
      </div>

      <div className="flex-1 min-w-0">
        <Suspense>
          <ShopToolbar total={data.total} categories={categoryThumbs} />
        </Suspense>

        {data.products.length === 0 ? (
          <div className="py-16 sm:py-24 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full border border-[#2B1B0C]/20 bg-white flex items-center justify-center mb-4">
              <SearchX className="w-6 h-6 text-[#9C5A26]" />
            </div>
            <h2 className="font-heading font-bold text-lg text-[#2B1B0C] mb-1.5">No products found</h2>
            <p className="font-body text-sm text-[#8A7A63] mb-6 max-w-xs">
              Try a different intention or clear your filters to see everything we have.
            </p>
            <Link
              href="/shop"
              className="brutal-border bg-[#2B1B0C] text-white rounded-lg px-6 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200 shadow-[3px_3px_0_0_#9C5A26]"
            >
              Clear Filters
            </Link>
          </div>
        ) : (
          <>
            <ImpressionTracker
              listName="Shop"
              products={data.products}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {data.products.map((product) => (
                <ProductCard key={product.id} product={product} listName="Shop" />
              ))}
            </div>
            <Suspense>
              <ShopPagination page={data.page} pages={data.pages} />
            </Suspense>
          </>
        )}
      </div>
      </div>
    </div>
  );
}
