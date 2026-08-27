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
  profile: chatProfileSchema.partial().default({}),
  purpose: z.enum(PURPOSE_IDS).nullable().default(null),
  readyForProducts: z.boolean().default(false),
  // Short, personal explanation of WHY this category of remedy fits them — shown next to
  // the product cards. Required whenever readyForProducts is true.
  recommendationReason: z.string().max(400).nullable().default(null),
});
export type LlmTurn = z.infer<typeof llmTurnSchema>;
