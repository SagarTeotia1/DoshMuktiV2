'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CarouselImage {
  full: string;
}

// Native CSS scroll-snap does the actual touch swipe — no gesture library needed,
// every mobile browser already turns snap-x + overflow-x-auto into a real swipeable
// carousel. The JS here only drives the desktop arrow buttons and the active-dot
// indicator (via scroll position), it never intercepts touch input itself.
export function ImageCarousel({ images, alt }: { images: CarouselImage[]; alt: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function scrollToIndex(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const child = track.children[i] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, clientWidth } = track;
    const i = Math.round(scrollLeft / clientWidth);
    setActive(Math.max(0, Math.min(images.length - 1, i)));
  }

  if (images.length === 0) return null;

  // 3 or fewer photos fit in one row with no scrolling needed — arrows/dots implying
  // "more to swipe through" were misleading when there's nothing more, and the row
  // was left-aligned instead of centered like a deliberate small gallery.
  const needsScroll = images.length > 3;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className={`flex gap-4 sm:gap-5 ${
          needsScroll
            ? 'overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0'
            : 'justify-center flex-wrap'
        }`}
      >
        {images.map((img, i) => (
          <div
            key={img.full}
            className={`relative flex-shrink-0 w-[82vw] xs:w-[70vw] sm:w-[340px] aspect-square rounded-[1.75rem] overflow-hidden shadow-neo-sm ${
              needsScroll ? 'snap-center' : ''
            }`}
          >
            <Image
              src={img.full}
              alt={`${alt} — photo ${i + 1}`}
              fill
              className="object-cover"
              sizes="(min-width: 640px) 340px, 82vw"
            />
          </div>
        ))}
      </div>

      {needsScroll && (
        <>
          {/* Desktop-only arrow controls — mobile relies on the native touch swipe */}
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => scrollToIndex(Math.max(0, active - 1))}
            disabled={active === 0}
            className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-[#FFFDF8]/90 text-[#2B1B0C] shadow-neo-sm disabled:opacity-0 transition-opacity"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => scrollToIndex(Math.min(images.length - 1, active + 1))}
            disabled={active === images.length - 1}
            className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-[#FFFDF8]/90 text-[#2B1B0C] shadow-neo-sm disabled:opacity-0 transition-opacity"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-center gap-1.5 mt-5">
            {images.map((img, i) => (
              <button
                key={img.full}
                type="button"
                aria-label={`Go to photo ${i + 1}`}
                onClick={() => scrollToIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active ? 'w-6 bg-[#9C5A26]' : 'w-1.5 bg-[#9C5A26]/25'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
