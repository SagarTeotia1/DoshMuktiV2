'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { getSessionId } from '@/lib/session';
import type { CartResponse } from '@/types/api.types';

function sessionHeaders() {
  return { 'x-session-id': getSessionId() };
}

export function useCart() {
  const queryClient = useQueryClient();
  const sessionId = typeof window !== 'undefined' ? getSessionId() : '';
  const queryKey = ['cart', sessionId];

  const { data: cart, isLoading } = useQuery<CartResponse>({
    queryKey,
    queryFn: () => api.get<CartResponse>('/api/cart', sessionHeaders()),
    enabled: !!sessionId,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: (item: { variantId: string; quantity: number }) =>
      api.post<CartResponse>('/api/cart/items', item, sessionHeaders()),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      api.patch<CartResponse>(`/api/cart/items/${variantId}`, { quantity }, sessionHeaders()),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const removeMutation = useMutation({
    mutationFn: (variantId: string) =>
      api.delete<CartResponse>(`/api/cart/items/${variantId}`, sessionHeaders()),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });

  const addItem = useCallback((item: { variantId: string; quantity: number }) => addMutation.mutate(item), [addMutation]);
  const addItemAsync = useCallback((item: { variantId: string; quantity: number }) => addMutation.mutateAsync(item), [addMutation]);
  const updateQuantity = useCallback((variantId: string, quantity: number) => updateMutation.mutate({ variantId, quantity }), [updateMutation]);
  const removeItem = useCallback((variantId: string) => removeMutation.mutate(variantId), [removeMutation]);

  return {
    cart,
    isLoading,
    addItem,
    addItemAsync,
    updateQuantity,
    removeItem,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
