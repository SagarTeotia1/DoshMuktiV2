'use client';

import { useState } from 'react';
import { Quote, Star, BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';

interface ProductImageSet {
  thumb?: string;
  card?: string;
  full?: string;
}

interface RecentReview {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  product: { name: string; slug: string; images: ProductImageSet[] };
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? 'fill-[#9C5A26] text-[#9C5A26]' : 'text-[#2B1B0C]/15'}`} />
      ))}
    </div>
  );
}

const PAGE_SIZE = 3;

export function TestimonialsSection({ reviews }: { reviews: RecentReview[] }) {
  const [page, setPage] = useState(0);
  if (reviews.length === 0) return null;

  const pageCount = Math.ceil(reviews.length / PAGE_SIZE);
  const current = reviews.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="py-14 sm:py-20 md:py-24 bg-[#F6E4C2]/30 border-y border-[#2B1B0C]/10">
      <Reveal className="max-w-2xl mx-auto px-4 sm:px-6 mb-10 sm:mb-14 text-center">
        <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-3">
          Loved By 1,000+ Customers
        </p>
        <h2 className="font-heading font-black tracking-tighter uppercase leading-tight text-3xl sm:text-4xl text-[#2B1B0C]">
          What Our Customers Say
        </h2>
      </Reveal>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3 sm:gap-5">
        {pageCount > 1 && (
          <button
            onClick={() => setPage((p) => (p - 1 + pageCount) % pageCount)}
            className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full border border-[#2B1B0C]/15 bg-[#FFFDF8] items-center justify-center hover:border-[#9C5A26] hover:text-[#9C5A26] transition-colors"
            aria-label="Previous testimonials"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <StaggerGroup key={page} className="flex-1 min-w-0 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {current.map((review) => (
            <StaggerItem
              key={review.id}
              className="flex flex-col bg-[#FFFDF8] rounded-2xl shadow-neo-sm hover:shadow-neo-md transition-shadow duration-300 p-6"
            >
              <Quote className="w-5 h-5 text-[#9C5A26]/40 fill-[#9C5A26]/40 mb-3" />

              <Stars rating={review.rating} />

              <p className="font-body text-sm text-[#4A3620] leading-relaxed mt-3 mb-5 flex-1">
                &ldquo;{review.title || review.body}&rdquo;
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-[#2B1B0C]/8">
                <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#C9863F] to-[#9C5A26] flex items-center justify-center font-heading font-black text-xs text-white flex-shrink-0">
                  {review.customerName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-heading font-bold text-xs text-[#2B1B0C] truncate">{review.customerName}</p>
                    <BadgeCheck className="w-3.5 h-3.5 text-[#9C5A26] flex-shrink-0" />
                  </div>
                  <p className="font-body text-[11px] text-[#8A7A63] truncate">{review.product.name}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        {pageCount > 1 && (
          <button
            onClick={() => setPage((p) => (p + 1) % pageCount)}
            className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full border border-[#2B1B0C]/15 bg-[#FFFDF8] items-center justify-center hover:border-[#9C5A26] hover:text-[#9C5A26] transition-colors"
            aria-label="Next testimonials"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8 sm:hidden">
          <button
            onClick={() => setPage((p) => (p - 1 + pageCount) % pageCount)}
            className="w-9 h-9 rounded-full border border-[#2B1B0C]/15 bg-[#FFFDF8] flex items-center justify-center"
            aria-label="Previous testimonials"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage((p) => (p + 1) % pageCount)}
            className="w-9 h-9 rounded-full border border-[#2B1B0C]/15 bg-[#FFFDF8] flex items-center justify-center"
            aria-label="Next testimonials"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-6">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-label={`Go to page ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === page ? 'w-2 h-2 bg-[#9C5A26]' : 'w-1.5 h-1.5 bg-[#2B1B0C]/20 hover:bg-[#2B1B0C]/35'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
