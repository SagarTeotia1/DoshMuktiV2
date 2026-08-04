'use client';

import { ProductCard } from '@/components/storefront/ProductCard';
import type { Product } from '@/types/api.types';

export function RelatedProductsRail({ products }: { products: Product[] }) {
  return (
    <section className="mt-16 sm:mt-24">
      <div className="mb-6 sm:mb-8">
        <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
          You May Also Like
        </p>
        <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tighter uppercase text-[#2B1B0C]">
          Complete The Ritual
        </h2>
      </div>

      <div className="flex gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory pb-2 [scroll-padding-left:1rem] -mr-4 sm:-mr-6 lg:-mr-12">
        {products.map((p) => (
          <div key={p.id} className="flex-shrink-0 snap-start w-[42vw] sm:w-[220px] md:w-[240px] [scroll-margin-left:1rem]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
