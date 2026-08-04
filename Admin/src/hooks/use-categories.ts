'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useCategories() {
  return useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => api.get<string[]>('/api/admin/products/categories'),
  });
}
