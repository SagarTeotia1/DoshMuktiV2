import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ProductCardHorizontal } from '@/components/storefront/ProductCardHorizontal';
import { ShopFilters } from './shop-filters';
import { ShopFiltersMobile } from './shop-filters-mobile';
import { ShopToolbar } from './shop-toolbar';
import { ShopPagination } from './shop-pagination';
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
  view?: string;
};

// Purpose-filtered shop URLs are the highest-intent SEO/AEO surface on the site
// ("gemstones for wealth", "bracelet for love") — give each one its own title/
// description instead of every /shop?purpose=X sharing the generic catalog copy.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}): Promise<Metadata> {
  const { purpose } = await searchParams;
  const match = PURPOSES.find((p) => p.id === (purpose as PurposeId));

  const title = match ? `${match.label} — Gemstones & Remedies` : 'Shop All Products';
  const description = match
    ? `${match.description}. Authentic, energized gemstones, rudraksha and bracelets chosen with Vedic astrology guidance — shop the full ${match.label.toLowerCase()} collection.`
    : 'Browse the full Doshhmukti collection — gemstones, rudraksha malas, bracelets and pooja accessories for love, wealth, health, success, protection and clarity.';
  const canonical = match ? `/shop?purpose=${match.id}` : '/shop';

  return {
    title,
    description,
    alternates: { canonical },
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8 flex flex-col lg:flex-row gap-6 lg:gap-10">
      <div className="hidden lg:block lg:w-56 flex-shrink-0">
        <Suspense>
          <ShopFilters categories={categoryThumbs} />
        </Suspense>
      </div>

      <div className="flex-1 min-w-0">
        <Suspense>
          <ShopFiltersMobile categories={categoryThumbs} />
        </Suspense>
        <Suspense>
          <ShopToolbar />
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
            <div
              className={
                sp.view === 'list'
                  ? 'grid grid-cols-1 gap-3 sm:gap-4'
                  : 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5'
              }
            >
              {data.products.map((product) =>
                sp.view === 'list' ? (
                  <ProductCardHorizontal key={product.id} product={product} />
                ) : (
                  <ProductCard key={product.id} product={product} />
                )
              )}
            </div>
            <Suspense>
              <ShopPagination page={data.page} pages={data.pages} />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
