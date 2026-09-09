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
  name: z.string().max(80).nullable(),
  problem: z.string().max(300).nullable(),
  // model has asked "want a suggestion?" — gates readyForProducts to the NEXT turn's yes.
  // Nullable because the model emits null (not false) for "didn't touch this field" — same
  // convention as every other profile field.
  offeredSuggestion: z.boolean().nullable().default(false),
});
export type ChatProfile = z.infer<typeof chatProfileSchema>;

export const EMPTY_PROFILE: ChatProfile = {
  name: null,
  problem: null,
  offeredSuggestion: false,
};

// Strict shape the LLM must reply in (response_format: json_object). Anything the model
// gets wrong just fails this parse and we fall back to treating the raw text as the reply.
export const llmTurnSchema = z.object({
  reply: z.string().min(1),
  // Gemini (unlike the Groq model this was written against) sometimes emits explicit
  // "profile": null instead of omitting the field entirely — .default({}) only kicks in
  // for undefined, not null, so that used to fail this whole parse and dump the raw JSON
  // object to the user as the reply text. Treat null the same as "nothing new this turn".
  profile: chatProfileSchema.partial().nullable().default({}).transform((v) => v ?? {}),
  purpose: z.enum(PURPOSE_IDS).nullable().default(null),
  // Same null-vs-undefined gap as `profile` above — .default(false) alone doesn't catch
  // an explicit "readyForProducts": null.
  readyForProducts: z.boolean().nullable().default(false).transform((v) => v ?? false),
  // Short, personal explanation of WHY this category of remedy fits them — shown next to
  // the product cards. Required whenever readyForProducts is true.
  recommendationReason: z.string().max(400).nullable().default(null),
});
export type LlmTurn = z.infer<typeof llmTurnSchema>;

// Admin visibility only — a capped, TTL'd transcript + geo snapshot per session, stored
// as a single Redis JSON blob (see cacheKeys.chatSession). Not the LLM-facing shape.
export interface ChatLoggedMessage {
  role: 'user' | 'assistant';
  content: string;
  at: string; // ISO timestamp
}

export interface ChatSessionRecord {
  sessionId: string;
  ip: string;
  city: string | null;
  country: string | null;
  startedAt: string;
  lastMessageAt: string;
  messages: ChatLoggedMessage[];
}
