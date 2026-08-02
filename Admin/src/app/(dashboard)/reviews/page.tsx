'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Star, Check, X } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { useReviews, useModerateReview } from '@/hooks/use-reviews';
import { formatDate } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? 'fill-[#9C5A26] text-[#9C5A26]' : 'text-slate-200'}`} />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const [status, setStatus] = useState<string>('PENDING');
  const { data, isLoading } = useReviews(status || undefined);
  const moderate = useModerateReview();

  function handle(id: string, next: 'APPROVED' | 'REJECTED') {
    moderate.mutate(
      { id, status: next },
      {
        onSuccess: () => toast.success(next === 'APPROVED' ? 'Review approved' : 'Review rejected'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update review'),
      }
    );
  }

  return (
    <>
      <Topbar title="Reviews" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatus('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !status ? 'bg-[#9C5A26] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === s ? 'bg-[#9C5A26] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : !data || data.reviews.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-card p-10 text-center text-sm text-slate-400">
            No reviews {status ? `with status ${status}` : ''}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.reviews.map((review) => (
              <div key={review.id} className="bg-white border border-slate-200 rounded-lg shadow-card p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#9C5A26]">{review.product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Stars rating={review.rating} />
                      <span className="text-xs font-semibold text-slate-700">{review.customerName}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(review.createdAt)}</span>
                    </div>
                  </div>

                  {review.status === 'PENDING' ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handle(review.id, 'APPROVED')}
                        disabled={moderate.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handle(review.id, 'REJECTED')}
                        disabled={moderate.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        review.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {review.status}
                    </span>
                  )}
                </div>

                {review.title && <p className="text-sm font-semibold text-slate-900">{review.title}</p>}
                <p className="text-sm text-slate-600 leading-relaxed">{review.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
