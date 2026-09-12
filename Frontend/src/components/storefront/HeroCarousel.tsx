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
    const t = setTimeout(next, 5000);
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
          desktop image itself so a wide desktop banner never renders thin/flat on phones.
          width/height below are a placeholder 2.4:1 ratio, not the real banner size —
          Backend doesn't store per-banner dimensions yet. With only `w-full h-auto` in
          CSS, browsers use these attributes purely to reserve layout space before the
          image loads (CLS was 0.709 with zero reservation); once it loads, actual
          intrinsic size still governs final height. A banner far from 2.4:1 still
          shifts some — real fix is Backend capturing width/height at upload time. */}
      <Link key={banner.id} href={banner.link} aria-label="View banner" className="block w-full">
        <div className="relative w-full aspect-[4/3] overflow-hidden sm:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={banner.mobileImage?.full ?? banner.image.full}
            alt="Doshhmukti gemstone and astrology remedy promotion"
            className="absolute inset-0 w-full h-full object-cover"
            fetchPriority="high"
          />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.image.full}
          alt="Doshhmukti gemstone and astrology remedy promotion"
          width={1920}
          height={800}
          className="hidden sm:block w-full h-auto"
          fetchPriority="high"
        />
      </Link>

      {banners.length > 1 && (
        <>
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

          {/* Dot indicators — right side vertical. Visual dot stays 3px wide (design),
              but the button's own box is padded out to a ~24px hit area so the tap
              target isn't just the visible sliver (was flagged by Lighthouse). */}
          <div className="absolute right-5 sm:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActive(idx)}
                className="group flex items-center justify-center py-1.5 px-2.5"
                aria-label={`Go to slide ${idx + 1}`}
              >
                <span
                  className={`block transition-all duration-400 rounded-full ${
                    idx === active ? 'h-8 w-[3px] bg-[#9C5A26]' : 'h-2.5 w-[3px] bg-white/25 group-hover:bg-white/50'
                  }`}
                />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
