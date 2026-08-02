import { Suspense } from 'react';
import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ShopFilters } from './shop-filters';
import { ShopPagination } from './shop-pagination';
import { api } from '@/lib/api-client';
import type { PaginatedProducts } from '@/types/api.types';

type ShopSearchParams = { purpose?: string; category?: string; q?: string; featured?: string; sort?: string; page?: string };

async function getProducts(sp: ShopSearchParams) {
  const params = new URLSearchParams();
  if (sp.purpose) params.set('purpose', sp.purpose);
  if (sp.category) params.set('category', sp.category);
  if (sp.q) params.set('q', sp.q);
  if (sp.featured) params.set('featured', sp.featured);
  if (sp.sort) params.set('sort', sp.sort);
  if (sp.page) params.set('page', sp.page);

  try {
    return await api.get<PaginatedProducts>(`/api/products?${params.toString()}`);
  } catch {
    return { products: [], total: 0, pages: 0, page: 1 };
  }
}

async function getCategories(): Promise<string[]> {
  try {
    return await api.get<string[]>('/api/products/categories');
  } catch {
    return [];
  }
}

function pageHeading(sp: ShopSearchParams): { eyebrow: string; title: string } {
  if (sp.featured) return { eyebrow: 'Curated By Us', title: 'Doshmukti Special' };
  if (sp.category?.toLowerCase() === 'rudraksha') return { eyebrow: 'Sacred Beads', title: 'Rudraksha' };
  if (sp.category) return { eyebrow: 'Handcrafted', title: sp.category };
  if (sp.q) return { eyebrow: 'Search Results', title: `"${sp.q}"` };
  return { eyebrow: 'All Products', title: 'Shop' };
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const sp = await searchParams;
  const [data, categories] = await Promise.all([getProducts(sp), getCategories()]);
  const heading = pageHeading(sp);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12">
      <div className="mb-6 sm:mb-8">
        <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
          {heading.eyebrow}
        </p>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter uppercase text-[#2B1B0C]">{heading.title}</h1>
          <p className="font-body text-xs sm:text-sm text-[#8A7A63]">{data.total} products</p>
        </div>
      </div>

      <Suspense>
        <ShopFilters categories={categories} />
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
            className="bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-6 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200"
          >
            Clear Filters
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {data.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <Suspense>
            <ShopPagination page={data.page} pages={data.pages} />
          </Suspense>
        </>
      )}
    </div>
  );
}
