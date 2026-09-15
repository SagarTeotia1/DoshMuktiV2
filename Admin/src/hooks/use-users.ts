'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedUsers, AdminUserDetail } from '@/types/api.types';

export function useUsers(phone?: string) {
  return useQuery({
    queryKey: ['admin-users', phone],
    queryFn: () => api.get<PaginatedUsers>(`/api/admin/users${phone ? `?phone=${phone}` : ''}`),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['admin-user', id],
    queryFn: () => api.get<AdminUserDetail>(`/api/admin/users/${id}`),
    enabled: !!id,
  });
}
