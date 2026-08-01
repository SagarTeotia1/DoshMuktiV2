'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { InventoryProduct } from '@/types/api.types';

export function useInventory() {
  return useQuery({
    queryKey: ['admin-inventory'],
    queryFn: () => api.get<InventoryProduct[]>('/api/admin/inventory'),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { variantId: string; newQuantity: number; note?: string }) => api.post<void>('/api/admin/inventory/adjust', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-inventory'] }),
  });
}
