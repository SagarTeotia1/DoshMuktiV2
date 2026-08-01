import { Suspense } from 'react';
import { ProductCard } from '@/components/storefront/ProductCard';
import { ShopFilters } from './shop-filters';
import { api } from '@/lib/api-client';
import type { PaginatedProducts } from '@/types/api.types';

async function getProducts(sp: { purpose?: string; sort?: string; page?: string }) {
  const params = new URLSearchParams();
  if (sp.purpose) params.set('purpose', sp.purpose);
  if (sp.sort) params.set('sort', sp.sort);
  if (sp.page) params.set('page', sp.page);

  try {
    return await api.get<PaginatedProducts>(`/api/products?${params.toString()}`);
  } catch {
    return { products: [], total: 0, pages: 0, page: 1 };
  }
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const data = await getProducts(sp);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12">
      <div className="mb-6 sm:mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter uppercase text-[#2B1B0C]">Shop</h1>
        <p className="font-body text-xs sm:text-sm text-[#8A7A63] mt-1">{data.total} products</p>
      </div>

      <Suspense>
        <ShopFilters />
      </Suspense>

      {data.products.length === 0 ? (
        <p className="font-body text-sm text-[#8A7A63] py-12 text-center">No products found.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {data.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
