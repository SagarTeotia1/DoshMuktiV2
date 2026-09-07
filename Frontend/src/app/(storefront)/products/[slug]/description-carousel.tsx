'use client';

import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Consecutive 'image' blocks in the admin-composed description are grouped into one
// swipeable carousel instead of stacking full-width images one under another — mirrors
// ProductGallery's swipe interaction, but each slide keeps its own natural aspect ratio
// (no forced square crop) since these are arbitrary description photos, not the fixed
// product-shot gallery.
export function DescriptionCarousel({ images, name }: { images: { full: string }[]; name: string }) {
  const [active, setActive] = useState(0);

  function prev() {
    setActive((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    setActive((i) => (i + 1) % images.length);
  }

  const dragStartX = useRef<number | null>(null);
  const dragDeltaX = useRef(0);
  const SWIPE_THRESHOLD = 40;

  function onPointerDown(e: React.PointerEvent) {
    dragStartX.current = e.clientX;
    dragDeltaX.current = 0;
  }
  function onPointerMove(e: React.PointerEvent) {
    if (dragStartX.current === null) return;
    dragDeltaX.current = e.clientX - dragStartX.current;
  }
  function onPointerUp() {
    if (dragStartX.current === null) return;
    if (dragDeltaX.current <= -SWIPE_THRESHOLD) next();
    else if (dragDeltaX.current >= SWIPE_THRESHOLD) prev();
    dragStartX.current = null;
    dragDeltaX.current = 0;
  }

  if (images.length === 1) {
    return (
      <div className="w-full rounded-xl overflow-hidden border border-[#2B1B0C] shadow-neo-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[0]!.full} alt={name} className="w-full h-auto block" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="relative w-full rounded-xl overflow-hidden border border-[#2B1B0C] shadow-neo-sm bg-[#F6E4C2] touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[active]!.full} alt={`${name} — photo ${active + 1}`} className="w-full h-auto block" />

        <span className="absolute top-3 right-3 bg-[#2B1B0C]/80 text-[#E6D3AE] px-2 py-1 text-[10px] font-bold tabular-nums rounded-lg z-10">
          {active + 1} / {images.length}
        </span>

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
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {images.map((img, i) => (
          <button
            key={img.full + i}
            onClick={() => setActive(i)}
            aria-label={`View image ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === active ? 'w-5 bg-[#2B1B0C]' : 'w-1.5 bg-[#2B1B0C]/25 hover:bg-[#2B1B0C]/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
