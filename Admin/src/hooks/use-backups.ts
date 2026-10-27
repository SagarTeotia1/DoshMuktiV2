'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { BackupOverview, BackupRunResult } from '@/types/api.types';

export function useBackups() {
  return useQuery({
    queryKey: ['admin-backups'],
    queryFn: () => api.get<BackupOverview>('/api/admin/backups'),
  });
}

// Runs the same job as the nightly cron. Takes a few seconds; 409 = one is already running.
export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<BackupRunResult>('/api/admin/backups/run', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-backups'] }),
  });
}
