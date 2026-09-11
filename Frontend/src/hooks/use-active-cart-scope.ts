'use client';

import { useCart, type CartScope } from './use-cart';

// A customer who hit "Order Now" (Buy Now) is mid-checkout on that isolated pseudo-cart —
// if they then go back to browse and tap a plain "Add to Cart" somewhere else, that product
// must land in the SAME order they're about to pay for, not a separate cart the buyNow
// checkout never looks at (which reads as the first item having "disappeared"). This
// derives which cart is "active" from actual cart contents rather than a separate flag:
// once the buyNow pseudo-cart holds anything, every plain "Add to Cart" merges into it too,
// until that order is paid (server clears it, see checkout/controller.ts) or it expires.
export function useActiveCartScope(): CartScope {
  const { cart: buyNowCart } = useCart('buyNow');
  return buyNowCart && buyNowCart.items.length > 0 ? 'buyNow' : 'cart';
}
