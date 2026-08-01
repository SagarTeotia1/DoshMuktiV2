'use client';

import { useState, useCallback } from 'react';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('razorpay-sdk')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-sdk';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.body.appendChild(script);
  });
}

export function useRazorpay() {
  const [loading, setLoading] = useState(false);

  const openCheckout = useCallback(async (options: Omit<RazorpayOptions, 'key'>) => {
    setLoading(true);
    try {
      await loadScript();
      const rzp = new window.Razorpay({ key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!, ...options });
      rzp.open();
    } finally {
      setLoading(false);
    }
  }, []);

  return { openCheckout, loading };
}
