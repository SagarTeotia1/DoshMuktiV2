'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { CartScope } from '@/hooks/use-cart';

// Loaded on first open only — the drawer pulls in the whole checkout hook (cart, shipping
// quotes, Razorpay), none of which a page view that never opens it should pay for.
const CheckoutDrawer = dynamic(() => import('@/components/checkout/CheckoutDrawer').then((m) => m.CheckoutDrawer), {
  ssr: false,
});

interface CheckoutDrawerContextValue {
  /** Buy Now: drawer over the isolated one-item pseudo-cart. */
  openBuyNow: () => void;
  /** Cart icon: the same drawer over the real cart (or the active Buy Now cart). */
  openCart: (scope?: CartScope) => void;
}

const CheckoutDrawerContext = createContext<CheckoutDrawerContextValue>({
  openBuyNow: () => undefined,
  openCart: () => undefined,
});

export function BuyNowDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const [scope, setScope] = useState<CartScope>('buyNow');

  const openWith = useCallback((s: CartScope) => {
    setScope(s);
    setEverOpened(true);
    setOpen(true);
  }, []);
  const openBuyNow = useCallback(() => openWith('buyNow'), [openWith]);
  const openCart = useCallback((s: CartScope = 'cart') => openWith(s), [openWith]);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ openBuyNow, openCart }), [openBuyNow, openCart]);

  return (
    <CheckoutDrawerContext.Provider value={value}>
      {children}
      {everOpened && <CheckoutDrawer open={open} onClose={close} scope={scope} />}
    </CheckoutDrawerContext.Provider>
  );
}

export function useBuyNowDrawer() {
  return useContext(CheckoutDrawerContext);
}
