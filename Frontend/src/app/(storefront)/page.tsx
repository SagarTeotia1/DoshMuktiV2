import { HeroCarousel } from '@/components/storefront/HeroCarousel';
import { PurposeGrid } from '@/components/storefront/PurposeGrid';
import { TrustBar } from '@/components/storefront/TrustBar';
import { ProductCard } from '@/components/storefront/ProductCard';
import { api } from '@/lib/api-client';
import type { Product } from '@/types/api.types';

async function getFeaturedProducts(): Promise<Product[]> {
  try {
    return await api.get<Product[]>('/api/products/featured');
  } catch {
    return []; // Backend down — degrade to an empty section, never a crashed landing page
  }
}

export default async function LandingPage() {
  const featured = await getFeaturedProducts();

  return (
    <>
      <HeroCarousel />
      <PurposeGrid />
      <TrustBar />

      {featured.length > 0 && (
        <section className="py-10 sm:py-14 md:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
            <div className="mb-8 sm:mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
                  Handpicked
                </p>
                <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase text-[#2B1B0C] leading-none">
                  Featured Products
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {featured.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
