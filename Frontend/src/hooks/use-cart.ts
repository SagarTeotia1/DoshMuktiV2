'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { getSessionId, getBuyNowSessionId } from '@/lib/session';
import { trackRemoveFromCart } from '@/lib/firebase';
import type { CartResponse } from '@/types/api.types';

export type CartScope = 'cart' | 'buyNow';

function resolveSessionId(scope: CartScope): string {
  return scope === 'buyNow' ? getBuyNowSessionId() : getSessionId();
}

function sessionHeaders(scope: CartScope) {
  return { 'x-session-id': resolveSessionId(scope) };
}

export function useCart(scope: CartScope = 'cart') {
  const queryClient = useQueryClient();
  const sessionId = typeof window !== 'undefined' ? resolveSessionId(scope) : '';
  const queryKey = ['cart', sessionId, scope];

  const { data: cart, isLoading } = useQuery<CartResponse>({
    queryKey,
    queryFn: () => api.get<CartResponse>('/api/cart', sessionHeaders(scope)),
    enabled: !!sessionId,
    staleTime: 30_000,
  });

  function cartErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof ApiError && err.body.code === 'OUT_OF_STOCK') return 'No more of this item in stock';
    if (err instanceof ApiError && err.body.code === 'FREE_GIFT_ONLY') return "This item ships free with a qualifying order — it can't be bought on its own";
    return fallback;
  }

  const addMutation = useMutation({
    mutationFn: (item: { variantId: string; quantity: number }) =>
      api.post<CartResponse>('/api/cart/items', item, sessionHeaders(scope)),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
    onError: (err) => toast.error(cartErrorMessage(err, 'Could not add item — try again')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      api.patch<CartResponse>(`/api/cart/items/${variantId}`, { quantity }, sessionHeaders(scope)),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
    // Real stock can drop between when an item was added and when the customer taps
    // "+" on it — the request then fails with OUT_OF_STOCK, and without this the click
    // just silently did nothing (no optimistic update to roll back, no error surfaced).
    onError: (err) => {
      toast.error(cartErrorMessage(err, 'Could not update quantity — try again'));
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (variantId: string) =>
      api.delete<CartResponse>(`/api/cart/items/${variantId}`, sessionHeaders(scope)),
    onSuccess: (data, variantId) => {
      queryClient.setQueryData(queryKey, data);
      const removed = cart?.items.find((i) => i.variantId === variantId);
      if (removed) {
        trackRemoveFromCart({ id: removed.variantId, name: removed.productName, price: removed.price, quantity: removed.quantity });
      }
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete<void>('/api/cart', sessionHeaders(scope)),
    onSuccess: () => queryClient.setQueryData(queryKey, undefined),
  });

  const addItem = useCallback((item: { variantId: string; quantity: number }) => addMutation.mutate(item), [addMutation]);
  const addItemAsync = useCallback((item: { variantId: string; quantity: number }) => addMutation.mutateAsync(item), [addMutation]);
  const updateQuantity = useCallback((variantId: string, quantity: number) => updateMutation.mutate({ variantId, quantity }), [updateMutation]);
  const removeItem = useCallback((variantId: string) => removeMutation.mutate(variantId), [removeMutation]);
  const clearCart = useCallback(() => clearMutation.mutateAsync(), [clearMutation]);

  return {
    cart,
    isLoading,
    addItem,
    addItemAsync,
    updateQuantity,
    removeItem,
    clearCart,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
    isClearing: clearMutation.isPending,
  };
}
