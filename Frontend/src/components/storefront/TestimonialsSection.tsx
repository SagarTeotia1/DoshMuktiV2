'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Heart, Send, Quote, ChevronLeft, ChevronRight, Star } from 'lucide-react';
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

function productImage(review: RecentReview): string | null {
  return review.product.images?.[0]?.card ?? review.product.images?.[0]?.full ?? null;
}

export function TestimonialsSection({ reviews }: { reviews: RecentReview[] }) {
  const [active, setActive] = useState(0);
  if (reviews.length === 0) return null;

  const quote = reviews[active] ?? reviews[0]!;
  const quoteImage = productImage(quote);

  return (
    <section className="pt-6 sm:pt-8 pb-10 sm:pb-14 md:pb-20">
      {/* Reel-style strip */}
      <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 mb-6 sm:mb-8">
        <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-[#2B1B0C] text-center">
          What Our Customers Say
        </h2>
      </Reveal>

      <StaggerGroup className="flex flex-wrap justify-center gap-4 px-4 sm:px-6 lg:px-12 mb-12 sm:mb-16">
        {reviews.slice(0, 4).map((review) => {
          const img = productImage(review);
          return (
            <StaggerItem
              key={review.id}
              className="group relative flex-shrink-0 snap-start w-[160px] sm:w-[190px] aspect-[9/16] rounded-2xl overflow-hidden border border-[#2B1B0C]/15 bg-[#2B1B0C]"
            >
              {img ? (
                <Image
                  src={img}
                  alt={review.product.name}
                  fill
                  className="object-cover opacity-80 transition-opacity duration-300 group-hover:opacity-95"
                  sizes="200px"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ background: 'radial-gradient(circle at 30% 20%, #6B3D19, #2B1B0C)' }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />

              <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-[#9C5A26] border border-white/40 flex items-center justify-center font-heading font-black text-[10px] text-white flex-shrink-0">
                  {review.customerName.charAt(0)}
                </span>
                <span className="font-body text-[10px] font-bold text-white/90 truncate">{review.customerName}</span>
              </div>

              <p className="absolute bottom-9 left-2.5 right-2.5 font-heading font-bold text-[13px] text-white leading-snug line-clamp-3">
                &ldquo;{review.title || review.body}&rdquo;
              </p>

              <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                <Heart className="w-4 h-4 text-white/90" strokeWidth={1.75} />
                <Send className="w-3.5 h-3.5 text-white/90" strokeWidth={1.75} />
              </div>
            </StaggerItem>
          );
        })}
      </StaggerGroup>

      {/* Big quote carousel */}
      <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter text-[#2B1B0C] text-center mb-6 sm:mb-10">
          Testimonials
        </h2>

        <div className="relative bg-[#F6E4C2]/40 border border-[#2B1B0C]/10 rounded-2xl p-6 sm:p-10 md:p-14">
          <div className="grid md:grid-cols-[1fr_auto] gap-8 md:gap-14 items-center">
            <div>
              <Quote className="w-8 h-8 sm:w-10 sm:h-10 text-[#9C5A26]/40 fill-[#9C5A26]/10 mb-4" />
              <div className="flex items-center gap-0.5 mb-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < quote.rating ? 'fill-[#9C5A26] text-[#9C5A26]' : 'text-[#2B1B0C]/15'}`}
                  />
                ))}
              </div>
              <p className="font-body text-base sm:text-lg text-[#2B1B0C] leading-relaxed mb-6 max-w-xl">
                {quote.body}
              </p>
              <p className="font-heading font-bold text-sm text-[#2B1B0C]">{quote.customerName}</p>
              <p className="font-body text-xs text-[#8A7A63]">{quote.product.name}</p>
            </div>

            {quoteImage && (
              <div className="hidden md:block w-56 h-56 lg:w-64 lg:h-64 rounded-2xl overflow-hidden border border-[#2B1B0C]/10 relative flex-shrink-0">
                <Image src={quoteImage} alt={quote.product.name} fill className="object-cover" sizes="256px" />
              </div>
            )}
          </div>

          {reviews.length > 1 && (
            <>
              <button
                onClick={() => setActive((a) => (a - 1 + reviews.length) % reviews.length)}
                className="absolute left-2 sm:-left-5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-[#2B1B0C]/15 flex items-center justify-center hover:border-[#9C5A26] transition-colors shadow-neo-sm"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="w-4 h-4 text-[#2B1B0C]" />
              </button>
              <button
                onClick={() => setActive((a) => (a + 1) % reviews.length)}
                className="absolute right-2 sm:-right-5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-[#2B1B0C]/15 flex items-center justify-center hover:border-[#9C5A26] transition-colors shadow-neo-sm"
                aria-label="Next testimonial"
              >
                <ChevronRight className="w-4 h-4 text-[#2B1B0C]" />
              </button>
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}
