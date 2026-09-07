'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface ShippingEstimate {
  fee: number;
  originalFee: number;
}

// Public, unauthenticated endpoint. Without destPincode: an origin-to-origin estimate
// (real destination isn't known yet) — used on the PDP and cart. With destPincode: the
// real live-quoted rate for that destination — used once checkout has a validated
// pincode, so the displayed shipping fee updates to the actual charge instead of
// staying on the earlier estimate.
export function useShippingEstimate(subtotal: number, weightGrams: number, destPincode?: string) {
  return useQuery({
    queryKey: ['shipping-estimate', subtotal, weightGrams, destPincode],
    queryFn: () =>
      api.get<ShippingEstimate>(
        `/api/shipping/estimate?subtotal=${subtotal}&weightGrams=${weightGrams}${destPincode ? `&destPincode=${destPincode}` : ''}`
      ),
    enabled: subtotal > 0 && weightGrams > 0,
    staleTime: 5 * 60 * 1000,
  });
}
