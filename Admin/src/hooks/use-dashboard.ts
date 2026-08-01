'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { DashboardSummary, SalesTrendPoint } from '@/types/api.types';

export function useDashboard() {
  const summary = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardSummary>('/api/admin/dashboard'),
  });

  const sales = useQuery({
    queryKey: ['dashboard', 'sales'],
    queryFn: () => api.get<SalesTrendPoint[]>('/api/admin/dashboard/sales?days=30'),
  });

  return { summary, sales };
}
