'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { Category, ProductImage } from '@/types/api.types';

const KEY = ['admin-category-list'];

// Product form / offer form use the plain-name list (`useCategories`) — refresh it too
// whenever a category changes so those pickers never show stale names.
function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: KEY }), qc.invalidateQueries({ queryKey: ['admin-categories'] })]);
}

export function useCategoryList() {
  return useQuery({ queryKey: KEY, queryFn: () => api.get<Category[]>('/api/admin/categories') });
}

export interface CategoryInput {
  name: string;
  stripLabel: string | null;
  image: ProductImage | null;
  order: number;
  isActive: boolean;
}

export function useCreateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CategoryInput) => api.post<Category>('/api/admin/categories', input),
    onSuccess: invalidate,
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) => api.patch<Category>(`/api/admin/categories/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/categories/${id}`),
    onSuccess: invalidate,
  });
}
