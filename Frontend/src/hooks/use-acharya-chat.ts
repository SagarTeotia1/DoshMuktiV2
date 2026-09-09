'use client';

import { useState, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { getSessionId } from '@/lib/session';
import type { ChatMessage, ChatRecommendedProduct, ChatResponse } from '@/types/api.types';

export type DisplayMessage = ChatMessage & {
  recommendedProducts?: ChatRecommendedProduct[];
  recommendationReason?: string | null;
};

const GREETING: DisplayMessage = {
  role: 'assistant',
  content:
    "Hello, kaise hain aap? 🙏 Main hoon Acharya Madhav. Batayein — dil ki baat ho, career ho, paisa ho ya sehat — jo bhi chal raha hai, khulke bataiye, main sun raha hoon.",
};

// Cap what we send — mirrors the Backend's own 20-message limit, keeps requests small.
const MAX_HISTORY = 20;

export function useAcharyaChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([GREETING]);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: DisplayMessage = { role: 'user', content };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setIsSending(true);

      try {
        const history = nextMessages
          .slice(-MAX_HISTORY)
          .map((m) => ({ role: m.role, content: m.content }));
        const { reply, recommendedProducts, recommendationReason } = await api.post<ChatResponse>(
          '/api/chat/acharya',
          { messages: history },
          { 'x-session-id': getSessionId() }
        );
        setMessages((curr) => [
          ...curr,
          { role: 'assistant', content: reply, recommendedProducts, recommendationReason },
        ]);
      } catch (err) {
        const content =
          err instanceof ApiError && err.body.code === 'CHAT_DAILY_LIMIT'
            ? err.body.error
            : "I couldn't reach the stars just now — please try again in a moment.";
        setMessages((curr) => [...curr, { role: 'assistant', content }]);
      } finally {
        setIsSending(false);
      }
    },
    [messages]
  );

  return { messages, sendMessage, isSending };
}
