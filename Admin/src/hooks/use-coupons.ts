'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Coupon, CouponType, PaginatedCoupons } from '@/types/api.types';

export interface CouponsQuery {
  search?: string;
  status?: 'active' | 'archived';
  page?: number;
  pageSize?: number;
}

function buildQueryString(query: CouponsQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.status) params.set('status', query.status);
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 20));
  return params.toString();
}

export function useCoupons(query: CouponsQuery = {}) {
  return useQuery({
    queryKey: ['admin-coupons', query],
    queryFn: () => api.get<PaginatedCoupons>(`/api/admin/coupons?${buildQueryString(query)}`),
  });
}

export interface CreateCouponInput {
  code: string;
  type: CouponType;
  value: number;
  minOrder?: number | null;
  maxUses?: number | null;
  maxDiscount?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCouponInput) => api.post<Coupon>('/api/admin/coupons', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });
}

export interface UpdateCouponInput {
  code?: string;
  type?: CouponType;
  value?: number;
  minOrder?: number | null;
  maxUses?: number | null;
  maxDiscount?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCouponInput }) => api.patch<Coupon>(`/api/admin/coupons/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-coupons'] }),
  });
}
