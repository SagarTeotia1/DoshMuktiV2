'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Banner, ProductImage } from '@/types/api.types';

export function useBanners() {
  return useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => api.get<Banner[]>('/api/admin/banners'),
  });
}

export interface CreateBannerInput {
  image: ProductImage;
  link: string;
  order?: number;
  isActive?: boolean;
}

export function useCreateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBannerInput) => api.post<Banner>('/api/admin/banners', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
  });
}

export interface UpdateBannerInput {
  image?: ProductImage;
  link?: string;
  order?: number;
  isActive?: boolean;
}

export function useUpdateBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBannerInput }) => api.patch<Banner>(`/api/admin/banners/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
  });
}

export function useDeleteBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/banners/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
  });
}
