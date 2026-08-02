'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedReviews, Review } from '@/types/api.types';

export function useReviews(status?: string) {
  return useQuery({
    queryKey: ['admin-reviews', status],
    queryFn: () => api.get<PaginatedReviews>(`/api/admin/reviews${status ? `?status=${status}` : ''}`),
  });
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api.patch<Review>(`/api/admin/reviews/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  });
}
