import { z } from 'zod';
import { PURPOSE_IDS } from '../../shared/constants/purposes';

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20), // caps history sent per request — cost/abuse guard
});
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

// Profile collected across turns, persisted per session so a returning visitor in the
// same browser isn't asked the same thing again. Every field nullable — filled in
// gradually as the conversation progresses.
export const chatProfileSchema = z.object({
  name: z.string().max(80).nullable().default(null),
  dob: z.string().max(60).nullable().default(null),
  phone: z.string().max(30).nullable().default(null),
  problem: z.string().max(300).nullable().default(null),
  offeredSuggestion: z.boolean().nullable().default(false),
  askedForPhone: z.boolean().nullable().default(false),
  phoneCollected: z.boolean().nullable().default(false),
});
export type ChatProfile = z.infer<typeof chatProfileSchema>;

export const EMPTY_PROFILE: ChatProfile = {
  name: null,
  dob: null,
  phone: null,
  problem: null,
  offeredSuggestion: false,
  askedForPhone: false,
  phoneCollected: false,
};

// Strict shape the LLM must reply in (response_format: json_object). Anything the model
// gets wrong just fails this parse and we fall back to treating the raw text as the reply.
export const llmTurnSchema = z.object({
  reply: z.string().min(1),
  profile: chatProfileSchema.partial().nullable().default({}).transform((v) => v ?? {}),
  purpose: z.enum(PURPOSE_IDS).nullable().default(null),
  readyForProducts: z.boolean().nullable().default(false).transform((v) => v ?? false),
  recommendationReason: z.string().max(400).nullable().default(null),
});
export type LlmTurn = z.infer<typeof llmTurnSchema>;

// Admin visibility only — a capped, TTL'd transcript + geo snapshot per session, stored
// as a single Redis JSON blob (see cacheKeys.chatSession).
export interface ChatLoggedMessage {
  role: 'user' | 'assistant';
  content: string;
  at: string; // ISO timestamp
}

export interface ChatSessionRecord {
  sessionId: string;
  ip: string;
  phone?: string | null;
  name?: string | null;
  dob?: string | null;
  problem?: string | null;
  city: string | null;
  country: string | null;
  startedAt: string;
  lastMessageAt: string;
  messages: ChatLoggedMessage[];
}

export const chatLeadListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).optional(),
});
export type ChatLeadListQuery = z.infer<typeof chatLeadListQuerySchema>;
