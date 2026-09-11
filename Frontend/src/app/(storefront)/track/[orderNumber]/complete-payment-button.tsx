'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { getSessionId } from '@/lib/session';

// A cancelled/failed Razorpay payment leaves the order stuck at PENDING_PAYMENT with
// no way back in otherwise — this re-adds its items into the visitor's cart and sends
// them through checkout again, instead of a dead-end order they can never pay for.
export function CompletePaymentButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function completePayment() {
    setLoading(true);
    try {
      const { addedCount, skippedCount } = await api.post<{ addedCount: number; skippedCount: number }>(
        `/api/orders/${orderNumber}/resume`,
        {},
        { 'x-session-id': getSessionId() }
      );
      // Stock (or a deactivated variant) can genuinely change between when this order
      // was placed and now — resume skips whatever's no longer available rather than
      // failing the whole thing, but silently landing on checkout with fewer items than
      // expected (or none at all) would be confusing without saying why.
      if (addedCount === 0) {
        toast.error('All items in this order are now out of stock.');
        setLoading(false);
        return;
      }
      if (skippedCount > 0) {
        toast.warning(`${skippedCount} item${skippedCount === 1 ? '' : 's'} in this order ${skippedCount === 1 ? 'is' : 'are'} no longer available and were left out.`);
      }
      // resumeOrder adds items straight into the cart server-side — the checkout page's
      // own cart query has no idea that happened and, under its 30s staleTime, can still
      // be sitting on a stale (possibly empty) cart fetched before this button was even
      // clicked. Without invalidating here, checkout renders a ₹0 total on arrival.
      await queryClient.invalidateQueries({ queryKey: ['cart', getSessionId(), 'cart'] });
      router.push('/checkout');
    } catch {
      toast.error('Could not resume this order — try adding the items to your cart again.');
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={completePayment}
      disabled={loading}
      className="font-body text-xs font-bold uppercase tracking-wide text-white bg-[#9C5A26] rounded-full px-5 py-2.5 hover:bg-[#6B3D19] disabled:opacity-60 transition-colors flex-shrink-0"
    >
      {loading ? 'Loading...' : 'Complete Payment'}
    </button>
  );
}
