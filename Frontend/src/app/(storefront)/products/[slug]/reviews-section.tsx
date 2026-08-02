'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, MessageSquarePlus } from 'lucide-react';
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
  'bg-[#FBF1DF] border border-[#2B1B0C]/25 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:border-[#9C5A26] focus:outline-none font-body placeholder:text-[#8A7A63] transition-colors w-full';

function WriteReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ orderNumber: '', customerPhone: '', title: '', body: '' });
  const [rating, setRating] = useState(5);

  const mutation = useMutation({
    mutationFn: (input: CreateReviewInput) => api.post('/api/reviews', input),
    onSuccess: () => {
      toast.success('Review submitted — it will appear once approved.');
      qc.invalidateQueries({ queryKey: ['product-reviews', productId] });
      onDone();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Could not submit review'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.body.trim().length < 10) return toast.error('Review must be at least 10 characters');
    mutation.mutate({
      orderNumber: form.orderNumber.trim(),
      customerPhone: form.customerPhone.trim(),
      productId,
      rating,
      title: form.title.trim() || undefined,
      body: form.body.trim(),
    });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-[#2B1B0C] rounded-2xl p-5 sm:p-6 flex flex-col gap-3 mb-8">
      <p className="font-heading font-bold text-sm text-[#2B1B0C]">Write a Review</p>
      <p className="font-body text-xs text-[#8A7A63] -mt-1">
        Verified purchases only — enter the order number and phone number used at checkout.
      </p>

      <StarPicker value={rating} onChange={setRating} />

      <div className="grid grid-cols-2 gap-3">
        <input
          required
          placeholder="Order Number (DOSH-...)"
          value={form.orderNumber}
          onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
          className={inputClass}
        />
        <input
          required
          type="tel"
          placeholder="Phone used at checkout"
          value={form.customerPhone}
          onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
          className={inputClass}
        />
      </div>
      <input
        placeholder="Title (optional)"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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
    <section className="mt-16 sm:mt-24 max-w-3xl">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
            From Our Customers
          </p>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tighter uppercase text-[#2B1B0C]">Reviews</h2>
            {!!data?.totalReviews && (
              <div className="flex items-center gap-1.5">
                <Stars rating={Math.round(data.averageRating)} />
                <span className="font-body text-xs text-[#8A7A63]">
                  {data.averageRating.toFixed(1)} ({data.totalReviews})
                </span>
              </div>
            )}
          </div>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 font-body text-xs font-bold uppercase tracking-widest text-[#9C5A26] hover:text-[#2B1B0C] transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4" />
            Write a Review
          </button>
        )}
      </div>

      {showForm && <WriteReviewForm productId={productId} onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <p className="font-body text-sm text-[#8A7A63]">Loading reviews...</p>
      ) : !data || data.reviews.length === 0 ? (
        <p className="font-body text-sm text-[#8A7A63]">No reviews yet — be the first to share your experience.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.reviews.map((review) => (
            <div key={review.id} className="border-b border-[#2B1B0C]/10 pb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Stars rating={review.rating} />
                <span className="font-heading font-bold text-xs text-[#2B1B0C]">{review.customerName}</span>
                <span className="font-body text-[10px] text-[#8A7A63]">{formatDate(review.createdAt)}</span>
              </div>
              {review.title && <p className="font-heading font-bold text-sm text-[#2B1B0C] mb-1">{review.title}</p>}
              <p className="font-body text-sm text-[#6B5539] leading-relaxed">{review.body}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
