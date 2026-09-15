'use client';

import { useEffect, useRef } from 'react';
import { trackPurchase } from '@/lib/analytics';

// Fires the Purchase conversion event (GA4 + Meta Pixel) exactly once per order.
//
// Previously this fired from the checkout page's Razorpay `handler` callback the
// instant Razorpay reported client-side success — before /api/checkout/verify or the
// webhook ever confirmed the payment actually captured. An order that Razorpay reported
// as paid but that later failed verification, or got cancelled/refunded (fraud check,
// stock issue, failed capture), still counted as a Meta/GA "Purchase" forever — polluting
// ad-spend optimization with conversions that were never real revenue.
//
// Rendered only from /checkout/success once the order is fetched server-side and its
// payment status is actually CAPTURED (see success/page.tsx) — never speculatively.
// sessionStorage guard on top of that: a refresh of the success page re-mounts this
// component but must not double-count the same paid order as two purchases.
export function PurchaseTracker(order: { orderNumber: string; total: number; itemCount: number }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const key = `purchase-tracked:${order.orderNumber}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage unavailable (private mode etc) — fire anyway, better a rare
      // double-count on refresh than silently losing every purchase event.
    }

    trackPurchase(order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
