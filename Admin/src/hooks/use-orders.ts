'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedOrders, Order } from '@/types/api.types';

export function useOrders(status?: string) {
  return useQuery({
    queryKey: ['admin-orders', status],
    queryFn: () => api.get<PaginatedOrders>(`/api/admin/orders${status ? `?status=${status}` : ''}`),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => api.get<Order>(`/api/admin/orders/${id}`),
    enabled: !!id,
  });
}

export function useUpdateOrderStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: string; note?: string }) => api.patch<Order>(`/api/admin/orders/${id}/status`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
    },
  });
}
