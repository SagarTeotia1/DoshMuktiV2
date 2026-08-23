'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, MessageSquarePlus, Quote, Sparkles } from 'lucide-react';
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
      qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
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

export function ReviewsSection({ productId, productSlug }: { productId: string; productSlug: string }) {
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['product-reviews', productId],
    queryFn: () => api.get<ProductReviewsResponse>(`/api/products/${productSlug}/reviews`),
  });

  return (
    <section className="mt-16 sm:mt-24 max-w-5xl">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
            From Our Customers
          </p>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tighter uppercase text-[#2B1B0C]">Reviews</h2>
            {!!data?.totalReviews && (
              <div className="flex items-center gap-2 bg-[#F6E4C2]/50 border border-[#2B1B0C]/10 rounded-full pl-2.5 pr-3 py-1">
                <Stars rating={Math.round(data.averageRating)} />
                <span className="font-heading font-bold text-xs text-[#2B1B0C]">{data.averageRating.toFixed(1)}</span>
                <span className="font-body text-xs text-[#8A7A63]">
                  ({data.totalReviews} review{data.totalReviews === 1 ? '' : 's'})
                </span>
              </div>
            )}
          </div>
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
        <div className="grid sm:grid-cols-2 gap-4">
          {data.reviews.map((review) => (
            <div
              key={review.id}
              className="relative bg-[#FFFDF8] border border-[#2B1B0C]/10 rounded-2xl p-5 sm:p-6 shadow-neo-sm hover:shadow-neo-md transition-shadow duration-200"
            >
              <Quote className="absolute top-4 right-4 w-6 h-6 text-[#9C5A26]/15 fill-[#9C5A26]/10" />

              <div className="flex items-center gap-2.5 mb-3">
                <span className="w-8 h-8 rounded-full bg-[#9C5A26] flex items-center justify-center font-heading font-black text-xs text-white flex-shrink-0">
                  {review.customerName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-heading font-bold text-xs text-[#2B1B0C] truncate">{review.customerName}</p>
                  <p className="font-body text-[10px] text-[#8A7A63]">{formatDate(review.createdAt)}</p>
                </div>
              </div>

              <Stars rating={review.rating} />

              {review.title && (
                <p className="font-heading font-bold text-sm text-[#2B1B0C] mt-2.5 mb-1">{review.title}</p>
              )}
              <p className="font-body text-sm text-[#6B5539] leading-relaxed mt-1">{review.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
