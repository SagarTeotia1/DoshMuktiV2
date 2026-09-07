'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export interface WarehouseInfo {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

// Read-only — the pickup location is created/edited directly on Delhivery's own
// dashboard, never through this app. This just shows what Backend is configured with.
export function useWarehouseInfo() {
  return useQuery({
    queryKey: ['admin-warehouse'],
    queryFn: () => api.get<WarehouseInfo>('/api/admin/shipping/warehouse'),
  });
}

export interface RateCalcInput {
  destPincode: string;
  weightGrams: number;
  paymentMode: 'Pre-paid' | 'COD';
}

export function useCalculateRate() {
  return useMutation({
    mutationFn: (input: RateCalcInput) =>
      api.get<{ amount: number }>(
        `/api/admin/shipping/rate-calc?destPincode=${input.destPincode}&weightGrams=${input.weightGrams}&paymentMode=${encodeURIComponent(input.paymentMode)}`
      ),
  });
}
