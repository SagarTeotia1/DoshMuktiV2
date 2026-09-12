'use client';

import { useEffect } from 'react';
import { trackPurchase } from '@/lib/firebase';

// SmartGateway's hosted payment page means this success screen (reached only after the
// bank redirects back through /checkout/return) is the first client-side code to run
// after a confirmed CHARGED payment — there's no earlier "payment succeeded" callback
// like the old Razorpay modal had. sessionStorage guards against double-firing the
// conversion event on a page refresh/back-navigation.
export function PurchaseTracker({ orderNumber, total, itemCount }: { orderNumber: string; total: number; itemCount: number }) {
  useEffect(() => {
    const key = `purchase-tracked:${orderNumber}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackPurchase({ orderNumber, total, itemCount });
  }, [orderNumber, total, itemCount]);

  return null;
}
