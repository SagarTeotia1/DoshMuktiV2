'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, MessageSquarePlus, Quote, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import type { ProductReviewsResponse, CreateReviewInput } from '@/types/api.types';

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i < rating ? 'fill-[#9C5A26] text-[#9C5A26]' : 'text-[#2B1B0C]/15'}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        return (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} star`}>
            <Star width={22} height={22} className={n <= value ? 'fill-[#9C5A26] text-[#9C5A26]' : 'text-[#2B1B0C]/20 hover:text-[#9C5A26]/50'} />
          </button>
        );
      })}
    </div>
  );
}

const inputClass =
  'bg-white border border-[#2B1B0C]/40 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:border-[#9C5A26] focus:outline-none font-body placeholder:text-[#6B5539] transition-colors w-full';

function WriteReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ customerName: '', body: '' });
  const [rating, setRating] = useState(5);

  const mutation = useMutation({
    mutationFn: (input: CreateReviewInput) => api.post('/api/reviews', input),
    onSuccess: () => {
      toast.success('Thanks for your review!');
      // No page index in this key — invalidates every cached page for this product,
      // not just whichever page the submitter happened to be viewing.
      qc.invalidateQueries({ queryKey: ['product-reviews', productId], exact: false });
      onDone();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Could not submit review'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.body.trim().length < 10) return toast.error('Review must be at least 10 characters');
    mutation.mutate({
      customerName: form.customerName.trim(),
      productId,
      rating,
      body: form.body.trim(),
    });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-[#2B1B0C] rounded-2xl p-5 sm:p-6 flex flex-col gap-3 mb-8">
      <p className="font-heading font-bold text-sm text-[#2B1B0C]">Write a Review</p>

      <StarPicker value={rating} onChange={setRating} />

      <input
        required
        placeholder="Your name"
        value={form.customerName}
        onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
        className={inputClass}
      />
      <textarea
        required
        rows={4}
        placeholder="Share your experience with this product..."
        value={form.body}
        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        className={inputClass}
      />

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-6 py-2.5 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200 disabled:opacity-50"
        >
          {mutation.isPending ? 'Submitting...' : 'Submit Review'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="font-body font-bold uppercase tracking-widest text-xs text-[#8A7A63] hover:text-[#2B1B0C] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function RatingBreakdown({
  ratingCounts,
  averageRating,
  totalReviews,
}: {
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
  averageRating: number;
  totalReviews: number;
}) {
  // Server-computed across ALL approved reviews, not just the current page — so these
  // bars stay accurate no matter which page of reviews is currently loaded.
  const counts = [5, 4, 3, 2, 1].map((star) => ratingCounts[star as 1 | 2 | 3 | 4 | 5]);

  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 bg-[#FFFDF8] border border-[#2B1B0C]/10 rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:gap-1 sm:w-32 flex-shrink-0">
        <p className="font-heading font-black text-4xl text-[#2B1B0C] leading-none">{averageRating.toFixed(1)}</p>
        <div className="flex flex-col gap-1">
          <Stars rating={Math.round(averageRating)} />
          <p className="font-body text-xs text-[#8A7A63]">{totalReviews} review{totalReviews === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-1.5 justify-center">
        {[5, 4, 3, 2, 1].map((star, i) => {
          const pct = totalReviews ? Math.round((counts[i]! / totalReviews) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2.5">
              <span className="font-body text-[11px] font-bold text-[#6B5539] w-3 flex-shrink-0">{star}</span>
              <Star width={11} height={11} className="fill-[#9C5A26] text-[#9C5A26] flex-shrink-0" />
              <div className="flex-1 h-1.5 rounded-full bg-[#2B1B0C]/10 overflow-hidden">
                <div className="h-full rounded-full bg-[#9C5A26] transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-body text-[10px] text-[#8A7A63] w-7 text-right flex-shrink-0">{counts[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReviewsSection({
  productId,
  productSlug,
  initialData,
}: {
  productId: string;
  productSlug: string;
  initialData?: ProductReviewsResponse;
}) {
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  // 6/page on laptop+ (lg, matches this file's lg:grid-cols-3 review grid — 6 lays out
  // as a clean 3x2), 5/page on mobile/tablet. Backend's productReviewsQuerySchema
  // default (5) and its 3-high:2-low interleaveByRating mix apply at whatever `limit`
  // is actually sent, so either page size still reads as a realistic mixed spread.
  const DESKTOP_REVIEWS_PER_PAGE = 6;
  const MOBILE_REVIEWS_PER_PAGE = 5;
  const [reviewsPerPage, setReviewsPerPage] = useState(MOBILE_REVIEWS_PER_PAGE);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    function applyMatch(matches: boolean) {
      setReviewsPerPage(matches ? DESKTOP_REVIEWS_PER_PAGE : MOBILE_REVIEWS_PER_PAGE);
      // A page number valid at one page size can be out of range at the other (e.g.
      // page 4 of 5-per-page doesn't exist at 6-per-page) — reset to page 1 whenever
      // the breakpoint actually flips, not on every resize event.
      setPage(1);
    }
    function handleChange(e: MediaQueryListEvent) {
      applyMatch(e.matches);
    }
    applyMatch(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Server already fetched this same 60s-ISR'd endpoint for JSON-LD (see page.tsx) — seeding
  // it here as initialData skips the client fetch waterfall, so reviews paint immediately
  // instead of the skeleton flashing on every load. staleTime matches that ISR window so
  // TanStack Query won't immediately re-fetch behind it. initialData only applies on the
  // very first mobile-sized render (page 1, default limit=5) — react-query only uses it
  // when the queryKey matches what generated it, so a desktop viewport (limit=6) just
  // fetches fresh instead of using a mismatched cached page.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['product-reviews', productId, page, reviewsPerPage],
    queryFn: () =>
      api.get<ProductReviewsResponse>(`/api/products/${productSlug}/reviews?page=${page}&limit=${reviewsPerPage}`),
    initialData: page === 1 && reviewsPerPage === MOBILE_REVIEWS_PER_PAGE ? initialData : undefined,
    staleTime: 60_000,
  });

  function goToPage(next: number) {
    setPage(next);
    document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section id="reviews-section" className="mt-16 sm:mt-24 max-w-5xl scroll-mt-24">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
            From Our Customers
          </p>
          <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tighter uppercase text-[#2B1B0C]">
            Customer Reviews
          </h2>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 font-body text-xs font-bold uppercase tracking-widest text-white bg-[#2B1B0C] rounded-full px-4 py-2.5 hover:bg-[#9C5A26] transition-colors shadow-neo-sm"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Write a Review
          </button>
        )}
      </div>

      {showForm && <WriteReviewForm productId={productId} onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-[#F6E4C2]/40 animate-pulse" />
          ))}
        </div>
      ) : !data || data.reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-3 rounded-2xl border border-dashed border-[#2B1B0C]/25 bg-[#FFFDF8] py-14 px-6">
          <div className="w-11 h-11 rounded-full bg-[#F6E4C2] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#9C5A26]" />
          </div>
          <p className="font-heading font-bold text-sm text-[#2B1B0C]">No reviews yet</p>
          <p className="font-body text-sm text-[#8A7A63] max-w-xs">
            Be the first to share how this piece has worked for you.
          </p>
        </div>
      ) : (
        <>
          <RatingBreakdown ratingCounts={data.ratingCounts} averageRating={data.averageRating} totalReviews={data.totalReviews} />

          {/* 3-col on lg — 5 reviews/page (the new mixed-rating default) lays out as a
              clean 3+2 instead of a lopsided 2-col grid with one orphaned card. */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.reviews.map((review) => (
              <div
                key={review.id}
                className="relative bg-[#FFFDF8] border border-[#2B1B0C]/10 rounded-2xl p-5 sm:p-6 shadow-neo-sm hover:shadow-neo-md hover:-translate-y-0.5 transition-all duration-250 flex flex-col"
              >
                <Quote className="absolute top-4 right-4 w-6 h-6 text-[#9C5A26]/15 fill-[#9C5A26]/10" />

                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-8 h-8 rounded-full bg-[#9C5A26] flex items-center justify-center font-heading font-black text-xs text-white flex-shrink-0">
                    {review.customerName.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-xs text-[#2B1B0C] truncate">
                      {review.customerName}
                    </p>
                    <p className="font-body text-[10px] text-[#8A7A63]">{formatDate(review.createdAt)}</p>
                  </div>
                </div>

                <div>
                  <Stars rating={review.rating} />
                </div>

                {review.title && (
                  <p className="font-heading font-bold text-sm text-[#2B1B0C] mt-2.5 mb-1">{review.title}</p>
                )}
                <p className="font-body text-sm text-[#6B5539] leading-relaxed mt-1 flex-1">
                  {review.body}
                </p>
              </div>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || isFetching}
                aria-label="Previous page of reviews"
                className="w-9 h-9 rounded-full border border-[#2B1B0C]/15 flex items-center justify-center hover:border-[#2B1B0C] hover:bg-[#F6E4C2] transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4 text-[#2B1B0C]" />
              </button>
              <span className="font-body text-xs font-bold text-[#6B5539] tabular-nums">
                Page {data.page} of {data.pages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= data.pages || isFetching}
                aria-label="Next page of reviews"
                className="w-9 h-9 rounded-full border border-[#2B1B0C]/15 flex items-center justify-center hover:border-[#2B1B0C] hover:bg-[#F6E4C2] transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="w-4 h-4 text-[#2B1B0C]" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
