'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedUsers, AdminUserDetail } from '@/types/api.types';

export function useUsers(phone?: string, page = 1) {
  const params = new URLSearchParams();
  if (phone) params.set('phone', phone);
  params.set('page', String(page));

  return useQuery({
    queryKey: ['admin-users', phone, page],
    queryFn: () => api.get<PaginatedUsers>(`/api/admin/users?${params.toString()}`),
    placeholderData: (prev) => prev,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => api.get<AdminUserDetail>(`/api/admin/users/${id}`),
    enabled: !!id,
  });
}
