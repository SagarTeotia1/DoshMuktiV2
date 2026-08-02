'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import type { ChatMessage, ChatResponse } from '@/types/api.types';

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    "Namaste, dear seeker 🙏 I am Acharya Madhav. Tell me what's on your mind — love, money, career, health — and I shall guide you through Vedic astrology and numerology.",
};

// Cap what we send — mirrors the Backend's own 20-message limit, keeps requests small.
const MAX_HISTORY = 20;

export function useAcharyaChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = { role: 'user', content };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setIsSending(true);

      try {
        const history = nextMessages.slice(-MAX_HISTORY);
        const { reply } = await api.post<ChatResponse>('/api/chat/acharya', { messages: history });
        setMessages((curr) => [...curr, { role: 'assistant', content: reply }]);
      } catch {
        setMessages((curr) => [
          ...curr,
          { role: 'assistant', content: "I couldn't reach the stars just now — please try again in a moment." },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [messages]
  );

  return { messages, sendMessage, isSending };
}
