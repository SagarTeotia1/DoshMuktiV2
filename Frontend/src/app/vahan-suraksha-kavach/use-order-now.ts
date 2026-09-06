'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { trackAddToCart } from '@/lib/firebase';

// Same "Order Now" flow as products/[slug]/add-to-cart.tsx's handleOrderNow — an
// isolated buy-now pseudo-cart, cleared and re-seeded with just this one item, then
// straight to /checkout?mode=buyNow (or /login first if not authenticated, same as
// everywhere else on the site). No new mechanism: this page is a marketing front door
// for one specific variant, not a separate purchase flow.
export function useOrderNow(variantId: string, productName: string, price: number) {
  const router = useRouter();
  const { addItemAsync: buyNowAddItemAsync, clearCart: buyNowClearCart } = useCart('buyNow');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [isOrdering, setIsOrdering] = useState(false);

  async function orderNow(quantity: number) {
    if (authLoading) return;
    setIsOrdering(true);
    try {
      await buyNowClearCart();
      await buyNowAddItemAsync({ variantId, quantity });
      trackAddToCart({ id: variantId, name: productName, price, quantity });
      if (!isAuthenticated) {
        router.push(`/login?redirect=${encodeURIComponent('/checkout?mode=buyNow')}`);
        return;
      }
      router.push('/checkout?mode=buyNow');
    } catch {
      toast.error('Could not start checkout — try again');
      setIsOrdering(false);
    }
  }

  return { orderNow, isOrdering };
}
