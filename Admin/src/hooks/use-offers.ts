'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Offer, OfferBehavior, OfferConfig, OfferReward, OfferScope, PaginatedOffers } from '@/types/api.types';

export interface OffersQuery {
  search?: string;
  behavior?: OfferBehavior;
  reward?: OfferReward;
  status?: 'active' | 'archived';
  page?: number;
  pageSize?: number;
}

function buildQueryString(query: OffersQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.behavior) params.set('behavior', query.behavior);
  if (query.reward) params.set('reward', query.reward);
  if (query.status) params.set('status', query.status);
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 20));
  return params.toString();
}

export function useOffers(query: OffersQuery = {}) {
  return useQuery({
    queryKey: ['admin-offers', query],
    queryFn: () => api.get<PaginatedOffers>(`/api/admin/offers?${buildQueryString(query)}`),
  });
}

export interface CreateOfferInput {
  title: string;
  behavior: OfferBehavior;
  reward: OfferReward;
  config: OfferConfig;
  couponId?: string | null;
  scope: OfferScope;
  category?: string | null; // required iff scope === 'CATEGORY'
  productIds?: string[]; // only meaningful when scope === 'SPECIFIC_PRODUCTS'
  minOrderValue?: number | null; // spend-threshold condition; always null for COUPON_BASED
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOfferInput) => api.post<Offer>('/api/admin/offers', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-offers'] }),
  });
}

export interface UpdateOfferInput {
  title?: string;
  behavior?: OfferBehavior;
  reward?: OfferReward;
  config?: OfferConfig;
  couponId?: string | null;
  isActive?: boolean;
  scope?: OfferScope;
  category?: string | null;
  productIds?: string[];
  minOrderValue?: number | null;
}

export function useUpdateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOfferInput }) => api.patch<Offer>(`/api/admin/offers/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-offers'] }),
  });
}

export function useDuplicateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Offer>(`/api/admin/offers/${id}/duplicate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-offers'] }),
  });
}
