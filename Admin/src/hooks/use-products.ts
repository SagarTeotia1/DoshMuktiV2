'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedProducts, Product, ProductVariant } from '@/types/api.types';

// `limit` is optional and only needed by callers that want more than the
// backend's default page (20) in one shot — e.g. the offer scope picker's
// "Specific Products" checkbox list, which wants as much of the catalog as
// the backend will hand back in a single page (capped at 100 server-side).
export function useProducts(status?: string, limit?: number, page?: number, q?: string) {
  return useQuery({
    queryKey: ['admin-products', status, limit, page, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (limit) params.set('limit', String(limit));
      if (page) params.set('page', String(page));
      if (q) params.set('q', q);
      const qs = params.toString();
      return api.get<PaginatedProducts>(`/api/admin/products${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => api.get<Product>(`/api/admin/products/${id}`),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Product>) => api.post<Product>('/api/admin/products', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Product>) => api.patch<Product>(`/api/admin/products/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product', id] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/admin/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-products'] }),
  });
}

export function useAddVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProductVariant>) => api.post<ProductVariant>(`/api/admin/products/${productId}/variants`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product', productId] });
    },
  });
}

export function useUpdateVariant(productId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: Partial<ProductVariant> }) =>
      api.patch<ProductVariant>(`/api/admin/variants/${variantId}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product', productId] });
    },
  });
}
