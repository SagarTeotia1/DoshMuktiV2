'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface ShippingEstimate {
  fee: number;
  originalFee: number;
}

// Public, unauthenticated endpoint — origin-to-origin estimate (real destination isn't
// known until checkout), same math the cart preview uses. Shown on the PDP so a
// customer sees an approximate shipping charge (or that it's free) before adding to cart.
export function useShippingEstimate(subtotal: number, weightGrams: number) {
  return useQuery({
    queryKey: ['shipping-estimate', subtotal, weightGrams],
    queryFn: () => api.get<ShippingEstimate>(`/api/shipping/estimate?subtotal=${subtotal}&weightGrams=${weightGrams}`),
    enabled: subtotal > 0 && weightGrams > 0,
    staleTime: 5 * 60 * 1000,
  });
}
