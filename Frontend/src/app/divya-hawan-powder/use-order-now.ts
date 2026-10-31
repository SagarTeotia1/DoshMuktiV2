'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useCart } from '@/hooks/use-cart';
import { useBuyNowDrawer } from '@/providers/buy-now-drawer-provider';
import { trackAddToCart } from '@/lib/analytics';

// Same "Order Now" flow as products/[slug]/add-to-cart.tsx's handleOrderNow — an
// isolated buy-now pseudo-cart, cleared and re-seeded with just this one item, then
// straight to /checkout?mode=buyNow. No separate auth check/redirect: /checkout
// itself handles phone+OTP login inline now, so an unauthenticated customer just
// lands there and logs in without leaving the page. This page is a marketing front
// door for one specific variant, not a separate purchase flow.
export function useOrderNow(variantId: string, productName: string, price: number) {
  const { openBuyNow } = useBuyNowDrawer();
  const { addItemAsync: buyNowAddItemAsync, clearCart: buyNowClearCart } = useCart('buyNow');
  const [isOrdering, setIsOrdering] = useState(false);

  async function orderNow(quantity: number) {
    setIsOrdering(true);
    try {
      await buyNowClearCart();
      await buyNowAddItemAsync({ variantId, quantity });
      trackAddToCart({ id: variantId, name: productName, price, quantity });
      setIsOrdering(false);
      openBuyNow();
    } catch {
      toast.error('Could not start checkout — try again');
      setIsOrdering(false);
    }
  }

  return { orderNow, isOrdering };
}
