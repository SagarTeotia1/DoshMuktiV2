'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Star, Tag } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types/api.types';

export function ProductCardHorizontal({ product }: { product: Product }) {
  const router = useRouter();
  const href = `/products/${product.slug}`;
  const prefetch = () => router.prefetch(href);
  const image = product.images[0]?.card ?? null;
  const activeVariants = product.variants.filter((v) => v.isActive);
  const price =
    activeVariants.length > 0
      ? Math.min(...activeVariants.map((v) => v.priceOverride ?? product.basePrice))
      : product.basePrice;
  const inStock = activeVariants.some((v) => v.stockQuantity > 0);

  const mrp = product.compareAtPrice && product.compareAtPrice > price ? product.compareAtPrice : null;
  const discountPct = mrp ? Math.round(((mrp - price) / mrp) * 100) : null;

  return (
    <Link
      href={href}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
      className="neo-card group flex items-stretch gap-4 rounded-2xl bg-[#FCEFE0] shadow-neo-sm pt-3 pl-3 pr-4 pb-4 sm:pt-4 sm:pl-4 sm:pr-5 sm:pb-5"
    >
      <div className="relative flex-shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden bg-[#F6E4C2] border border-[#2B1B0C] shadow-[4px_4px_0_0_#2B1B0C]">
        {image ? (
          <Image src={image} alt={product.name} fill className="object-cover" sizes="144px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[#8A7A63] text-[10px] font-bold uppercase tracking-widest">No Image</span>
          </div>
        )}

        {discountPct ? (
          <div className="absolute top-1.5 left-1.5 z-10">
            <span className="sticker brutal-border flex items-center gap-1 bg-[#B23A2E] text-white pl-1 pr-1.5 py-0.5 text-[8px] font-bold font-body rounded-md shadow-[2px_2px_0_0_#2B1B0C] whitespace-nowrap">
              <Tag className="w-2 h-2" />
              {discountPct}% off
            </span>
          </div>
        ) : null}

        {product.badge && (
          <span className="absolute bottom-1 right-1 z-10 -rotate-[8deg] px-1.5 py-1 rounded border-2 border-[#B23A2E]/80 bg-[#FBF1DF]/90 backdrop-blur-[1px] flex items-center justify-center shadow-[2px_3px_6px_rgba(43,27,12,0.35)]">
            <span className="absolute inset-[2px] rounded-sm border border-dashed border-[#B23A2E]/60" />
            <span className="relative text-[7px] font-black font-body uppercase tracking-wide text-[#B23A2E]/90 text-center leading-[1.1] px-1">
              {product.badge}
            </span>
          </span>
        )}

        {!inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-20">
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#2B1B0C] border border-[#2B1B0C] bg-white px-1.5 py-0.5 rounded-full">
              Sold Out
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-center min-w-0 py-1">
        <h3 className="text-sm sm:text-base font-bold text-[#2B1B0C] group-hover:text-[#6B3D19] transition-colors line-clamp-2 font-heading leading-snug tracking-tight">
          {product.name}
        </h3>

        {product.rating.count > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < Math.round(product.rating.average) ? 'fill-[#B23A2E] text-[#B23A2E]' : 'text-[#2B1B0C]/15'}`}
                />
              ))}
            </div>
            <span className="font-body text-xs text-[#8A7A63]">({product.rating.count})</span>
          </div>
        )}

        <div className="flex items-baseline gap-2 mt-2">
          <p className="text-base sm:text-lg font-bold text-[#2B1B0C] font-heading tracking-tight tabular-nums">
            {formatCurrency(price)}
          </p>
          {mrp && <p className="text-xs sm:text-sm text-[#8A7A63] line-through font-body tabular-nums">{formatCurrency(mrp)}</p>}
        </div>

        {product.description && (
          <p className="hidden sm:block font-body text-xs text-[#8A7A63] line-clamp-2 mt-2 leading-relaxed">
            {product.description}
          </p>
        )}
      </div>
    </Link>
  );
}
