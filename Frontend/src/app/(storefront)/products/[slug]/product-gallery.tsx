'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

  function prev() {
    setActive((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setActive((i) => (i + 1) % images.length);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-[#2B1B0C] aspect-square bg-[#F6E4C2] rounded-2xl relative overflow-hidden shadow-neo-lg">
        {images.map((img, i) => (
          <Image
            key={img.full}
            src={img.full}
            alt={`${name} — photo ${i + 1}`}
            fill
            className={`object-cover transition-opacity duration-300 ${i === active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority={i === 0}
          />
        ))}

        {!current && (
          <div className="w-full h-full flex items-center justify-center text-[#8A7A63] text-xs font-bold uppercase tracking-widest">
            No Image
          </div>
        )}

        {badge && (
          <span className="brutal-border absolute top-3 left-3 bg-[#9C5A26] text-[#2B1B0C] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider z-10 rounded-lg shadow-[2px_2px_0_0_#2B1B0C]">
            {badge}
          </span>
        )}

        {images.length > 1 && (
          <span className="absolute top-3 right-3 bg-[#2B1B0C]/80 text-[#E6D3AE] px-2 py-1 text-[10px] font-bold tabular-nums rounded-lg z-10">
            {active + 1} / {images.length}
          </span>
        )}

        {!inStock && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
            <span className="brutal-border text-xs font-bold uppercase tracking-widest text-[#2B1B0C] bg-white px-3 py-1.5 rounded-lg">
              Sold Out
            </span>
          </div>
        )}

        {/* Prev/next — bottom-left cluster, off to the side so they never sit over the subject of the photo */}
        {images.length > 1 && (
          <div className="absolute left-3 bottom-3 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm border border-[#2B1B0C]/15 flex items-center justify-center hover:bg-white transition-colors shadow-neo-sm"
            >
              <ChevronLeft className="w-4 h-4 text-[#2B1B0C]" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm border border-[#2B1B0C]/15 flex items-center justify-center hover:bg-white transition-colors shadow-neo-sm"
            >
              <ChevronRight className="w-4 h-4 text-[#2B1B0C]" />
            </button>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto hide-scrollbar py-2">
          {/* py-2 (not just pb-1) — overflow-x-auto forces the y-axis to auto-clip too per spec,
              so the active thumbnail's lift (-translate-y-0.5) and hard shadow need real room
              inside the row's own box, or they get cut off top/bottom. */}
          {images.map((img, i) => (
            <button
              key={img.thumb + i}
              onClick={() => setActive(i)}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                i === active
                  ? 'border-[#2B1B0C] shadow-neo-md -translate-y-0.5'
                  : 'border-[#2B1B0C]/15 opacity-70 hover:opacity-100 hover:border-[#2B1B0C]/40'
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
