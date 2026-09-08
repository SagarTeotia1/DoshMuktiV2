'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedPickupRequests } from '@/types/api.types';

// Shipments booked with Delhivery but not yet swept into a pickup batch — drives the
// "N shipments waiting for pickup" callout so an admin knows a batch is due.
export function usePendingPickupCount() {
  return useQuery({
    queryKey: ['admin-pickup-pending-count'],
    queryFn: () => api.get<{ count: number }>('/api/admin/pickup-requests/pending-count'),
    refetchInterval: 60_000,
  });
}

export function usePickupRequests(page = 1) {
  return useQuery({
    queryKey: ['admin-pickup-requests', page],
    queryFn: () => api.get<PaginatedPickupRequests>(`/api/admin/pickup-requests?page=${page}`),
  });
}

// One call books a single Delhivery pickup slot for every shipment currently waiting —
// never one request per order. See Backend's pickup-requests/service.ts.
export function useCreatePickupRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { pickupDate: string; pickupTime: string }) =>
      api.post<{ id: string; delhiveryPickupId?: string; expectedPackageCount: number }>('/api/admin/pickup-requests', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pickup-pending-count'] });
      qc.invalidateQueries({ queryKey: ['admin-pickup-requests'] });
    },
  });
}
