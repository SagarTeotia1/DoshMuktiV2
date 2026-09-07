'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import { getSessionId } from '@/lib/session';

// A cancelled/failed Razorpay payment leaves the order stuck at PENDING_PAYMENT with
// no way back in otherwise — this re-adds its items into the visitor's cart and sends
// them through checkout again, instead of a dead-end order they can never pay for.
export function CompletePaymentButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function completePayment() {
    setLoading(true);
    try {
      await api.post(`/api/orders/${orderNumber}/resume`, {}, { 'x-session-id': getSessionId() });
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
