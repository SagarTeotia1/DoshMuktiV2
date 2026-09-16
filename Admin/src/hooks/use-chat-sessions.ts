'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type {
  ChatSessionDetail,
  ChatSessionSummary,
  ChatVolumePoint,
  PaginatedChatLeads,
  ChatLead,
  ChatLeadStatus,
} from '@/types/api.types';

export function useChatSessions() {
  return useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => api.get<{ sessions: ChatSessionSummary[] }>('/api/admin/chat-sessions'),
    staleTime: 30_000,
  });
}

export function useChatVolume(days = 30) {
  return useQuery({
    queryKey: ['chat-sessions', 'volume', days],
    queryFn: () => api.get<{ trend: ChatVolumePoint[] }>(`/api/admin/chat-sessions/volume?days=${days}`),
    staleTime: 60_000,
  });
}

export function useChatSessionDetail(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat-sessions', sessionId],
    queryFn: () => api.get<ChatSessionDetail>(`/api/admin/chat-sessions/${sessionId}`),
    enabled: !!sessionId,
  });
}

export function useChatLeads(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  if (params?.status) query.set('status', params.status);

  return useQuery({
    queryKey: ['chat-leads', params],
    queryFn: () => api.get<PaginatedChatLeads>(`/api/admin/chat-leads?${query.toString()}`),
    staleTime: 30_000,
  });
}

export function useUpdateChatLeadStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status?: ChatLeadStatus; notes?: string }) =>
      api.patch<ChatLead>(`/api/admin/chat-leads/${id}/status`, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-leads'] });
    },
  });
}
