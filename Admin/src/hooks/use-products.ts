'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedProducts, Product, ProductVariant } from '@/types/api.types';

export function useProducts(status?: string) {
  return useQuery({
    queryKey: ['admin-products', status],
    queryFn: () => api.get<PaginatedProducts>(`/api/admin/products${status ? `?status=${status}` : ''}`),
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
