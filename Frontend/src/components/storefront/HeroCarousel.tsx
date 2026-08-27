'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Banner } from '@/types/api.types';

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setActive((a) => (a + 1) % banners.length), [banners.length]);
  const prev = useCallback(() => setActive((a) => (a - 1 + banners.length) % banners.length), [banners.length]);

  useEffect(() => {
    if (paused || banners.length <= 1) return;
    const t = setTimeout(next, 5500);
    return () => clearTimeout(t);
  }, [active, paused, next, banners.length]);

  if (banners.length === 0) return null;
  const banner = banners[active];
  if (!banner) return null;

  return (
    <section className="relative w-full" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Desktop: plain <img>, no `fill`/object-fit — height is the image's own natural
          ratio at 100% width, so nothing is ever cropped. Mobile: fixed-ratio crop via
          object-cover — uses `mobileImage` when the admin uploaded one, else crops the
          desktop image itself so a wide desktop banner never renders thin/flat on phones. */}
      <Link key={banner.id} href={banner.link} aria-label="View banner" className="block w-full">
        <div className="relative w-full aspect-[4/3] overflow-hidden sm:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.mobileImage?.full ?? banner.image.full} alt="" className="absolute inset-0 w-full h-full object-cover" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={banner.image.full} alt="" className="hidden sm:block w-full h-auto" />
      </Link>

      {banners.length > 1 && (
        <>
          {/* Slide counter — top right */}
          <div className="absolute top-5 right-6 sm:top-7 sm:right-10 z-30 flex items-center gap-2.5">
            <span className="font-heading font-black text-[#9C5A26] text-base sm:text-lg leading-none tabular-nums">
              {String(active + 1).padStart(2, '0')}
            </span>
            <div className="h-px w-6 sm:w-8 bg-white/25" />
            <span className="font-heading font-bold text-white/25 text-xs sm:text-sm leading-none tabular-nums">
              {String(banners.length).padStart(2, '0')}
            </span>
          </div>

          {/* Prev / Next — bottom left cluster */}
          <div className="absolute left-6 sm:left-10 md:left-14 lg:left-16 bottom-6 sm:bottom-8 z-30 flex items-center gap-2">
            <button
              onClick={prev}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/20 flex items-center justify-center hover:border-[#9C5A26] hover:bg-[#9C5A26]/10 transition-all duration-200 backdrop-blur-sm"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
            <button
              onClick={next}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/20 flex items-center justify-center hover:border-[#9C5A26] hover:bg-[#9C5A26]/10 transition-all duration-200 backdrop-blur-sm"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </button>
          </div>

          {/* Dot indicators — right side vertical */}
          <div className="absolute right-5 sm:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2.5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActive(idx)}
                className={`transition-all duration-400 block ${
                  idx === active ? 'h-8 w-[3px] rounded-full bg-[#9C5A26]' : 'h-2.5 w-[3px] rounded-full bg-white/25 hover:bg-white/50'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
