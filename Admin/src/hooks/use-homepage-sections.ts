'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { AdminHomepageSection } from '@/types/api.types';

export function useHomepageSections() {
  return useQuery({
    queryKey: ['admin-homepage-sections'],
    queryFn: () => api.get<AdminHomepageSection[]>('/api/admin/homepage-sections'),
  });
}

export interface CreateHomepageSectionInput {
  key: string;
  title: string;
  order?: number;
  isActive?: boolean;
}

export function useCreateHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHomepageSectionInput) => api.post<AdminHomepageSection>('/api/admin/homepage-sections', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-homepage-sections'] }),
  });
}

export interface UpdateHomepageSectionInput {
  title?: string;
  order?: number;
  isActive?: boolean;
}

export function useUpdateHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHomepageSectionInput }) =>
      api.patch<AdminHomepageSection>(`/api/admin/homepage-sections/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-homepage-sections'] }),
  });
}

export function useSetHomepageSectionItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, productIds }: { id: string; productIds: string[] }) =>
      api.put<AdminHomepageSection>(`/api/admin/homepage-sections/${id}/items`, { productIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-homepage-sections'] }),
  });
}

export function useDeleteHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/homepage-sections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-homepage-sections'] }),
  });
}
