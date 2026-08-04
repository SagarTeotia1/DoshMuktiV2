'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Offer } from '@/types/api.types';

export function useOffers() {
  return useQuery({
    queryKey: ['admin-offers'],
    queryFn: () => api.get<Offer[]>('/api/admin/offers'),
  });
}

export type CreateOfferInput = Pick<Offer, 'title' | 'type'> &
  Partial<Pick<Offer, 'cashbackPercent' | 'discountType' | 'discountValue' | 'maxDiscount' | 'freeProductId'>>;

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferInput) => api.post<Offer>('/api/admin/offers', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-offers'] }),
  });
}

export function useUpdateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>> }) =>
      api.patch<Offer>(`/api/admin/offers/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-offers'] }),
  });
}
