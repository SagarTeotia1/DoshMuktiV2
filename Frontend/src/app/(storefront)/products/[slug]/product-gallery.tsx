'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Product } from '@/types/api.types';

export function ProductGallery({
  images,
  name,
  badge,
  inStock,
}: {
  images: Product['images'];
  name: string;
  badge: string | null;
  inStock: boolean;
}) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square bg-[#F6E4C2] border border-[#2B1B0C] rounded-2xl relative overflow-hidden product-image-container">
        {current ? (
          <Image
            key={current.full}
            src={current.full}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#8A7A63] text-xs font-bold uppercase tracking-widest">
            No Image
          </div>
        )}

        {badge && (
          <span className="absolute top-3 left-3 bg-[#9C5A26] text-[#2B1B0C] border border-[#2B1B0C] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider z-10 rounded-full">
            {badge}
          </span>
        )}

        {!inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[#2B1B0C] border border-[#2B1B0C] bg-white px-3 py-1.5 rounded-full">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
          {images.map((img, i) => (
            <button
              key={img.thumb + i}
              onClick={() => setActive(i)}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border transition-all duration-200 ${
                i === active ? 'border-[#9C5A26] ring-2 ring-[#9C5A26]/30' : 'border-[#2B1B0C]/20 hover:border-[#2B1B0C]'
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image src={img.thumb} alt={`${name} thumbnail ${i + 1}`} fill className="object-cover" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
