'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import type { Address, AddressInput } from '@/types/api.types';

const QUERY_KEY = ['addresses'];

export function useAddresses(enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<Address[]>('/api/addresses', { Authorization: `Bearer ${getToken()}` }, 0),
    enabled,
  });
}

export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) =>
      api.post<Address>('/api/addresses', input, { Authorization: `Bearer ${getToken()}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/addresses/${id}`, { Authorization: `Bearer ${getToken()}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
