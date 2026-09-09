'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { ChatSessionDetail, ChatSessionSummary, ChatVolumePoint } from '@/types/api.types';

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
