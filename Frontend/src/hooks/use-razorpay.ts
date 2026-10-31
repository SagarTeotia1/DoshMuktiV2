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
  prefill?: { name?: string; email?: string; contact?: string; method?: 'upi' | 'card' | 'netbanking' | 'wallet' };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
  config?: RazorpayDisplayConfig;
}

// Razorpay's default UPI block can lead with one specific app (Google Pay) — on phones
// without it the customer hits an error. Declaring our own blocks makes UPI a generic
// entry: Razorpay lists only the UPI apps actually installed on the device (intent), plus
// "enter UPI ID" and QR, never a preselected app.
interface RazorpayDisplayConfig {
  display: {
    blocks: Record<string, { name: string; instruments: Array<Record<string, unknown>> }>;
    sequence: string[];
    preferences: { show_default_blocks: boolean };
  };
}

const CHECKOUT_DISPLAY_CONFIG: RazorpayDisplayConfig = {
  display: {
    blocks: {
      upi: { name: 'Pay via UPI', instruments: [{ method: 'upi', flows: ['intent', 'collect', 'qr'] }] },
      card: { name: 'Cards', instruments: [{ method: 'card' }] },
      netbanking: { name: 'Netbanking', instruments: [{ method: 'netbanking' }] },
      wallet: { name: 'Wallets', instruments: [{ method: 'wallet' }] },
    },
    sequence: ['block.upi', 'block.card', 'block.netbanking', 'block.wallet'],
    preferences: { show_default_blocks: false },
  },
};

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
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        config: CHECKOUT_DISPLAY_CONFIG,
        ...options,
        // Land straight on the UPI screen (installed apps / UPI ID / QR); the customer can
        // still switch to cards, netbanking or wallets from there.
        prefill: { method: 'upi', ...options.prefill },
      });
      rzp.open();
    } finally {
      setLoading(false);
    }
  }, []);

  return { openCheckout, loading };
}
