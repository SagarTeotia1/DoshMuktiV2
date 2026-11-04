'use client';

import { ProductCard } from '@/components/storefront/ProductCard';
import type { Product } from '@/types/api.types';

export function RelatedProductsRail({ products }: { products: Product[] }) {
  return (
    <section className="mt-10 sm:mt-14">
      <div className="mb-6 text-center sm:mb-8">
        <h2 className="font-heading text-3xl leading-[1.1] tracking-tight text-[#2B1B0C] sm:text-4xl md:text-5xl">
          <span className="font-black">You May</span>{' '}
          <span className="font-light italic text-[#9C5A26]">Also Like</span>
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
