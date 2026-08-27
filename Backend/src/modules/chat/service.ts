import { chatCompletion, GroqNotConfiguredError, type ChatMessage } from '../../shared/integrations/groq/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import { getProductsForChatRecommendation } from '../products/service';
import { retrieveRelevantChunks, type RetrievedChunk } from './bookRetrieval';
import { EMPTY_PROFILE, llmTurnSchema, type ChatProfile, type ChatRequestInput } from './schema';

const FALLBACK_REPLY =
  "Acharya Madhav is resting for a moment — please try again shortly, or reach us on WhatsApp for immediate guidance.";

async function loadProfile(sessionId: string | null): Promise<ChatProfile> {
  if (!sessionId) return EMPTY_PROFILE;
  const cached = await redis.get<ChatProfile>(cacheKeys.chatProfile(sessionId));
  return cached ?? EMPTY_PROFILE;
}

async function saveProfile(sessionId: string | null, profile: ChatProfile): Promise<void> {
  if (!sessionId) return;
  await redis.set(cacheKeys.chatProfile(sessionId), profile, { ex: CACHE_TTL.CHAT_PROFILE });
}

// Only ever widen the stored profile — a turn where the model didn't extract a field
// (or the user's last message didn't mention it) must never blank out something we
// already collected.
function mergeProfile(existing: ChatProfile, incoming: Partial<ChatProfile>): ChatProfile {
  return {
    name: incoming.name ?? existing.name,
    problem: incoming.problem ?? existing.problem,
    offeredSuggestion: incoming.offeredSuggestion ?? existing.offeredSuggestion,
  };
}

function buildSystemPrompt(profile: ChatProfile, bookChunks: RetrievedChunk[]): string {
  const knownLines = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.problem ? `What's troubling them: ${profile.problem}` : null,
  ].filter(Boolean);

  const flowStage = !profile.problem
    ? 'GATHERING'
    : !profile.offeredSuggestion
      ? 'READING'
      : 'OFFERED';

  const bookContext =
    bookChunks.length > 0
      ? `\n\nRelevant passages from your reference text:\n${bookChunks.map((c) => `- ${c.content}`).join('\n')}\n\nGround your reading in these passages where relevant — paraphrase them naturally in your own voice, never quote verbatim or robotically, never mention "passages" or "reference text" to the user.`
      : '';

  const stageInstructions: Record<typeof flowStage, string> = {
    GATHERING: `Still need to know what's troubling them. Ask for it naturally, warmly — never a cold form-like question. If they've shared something else first, acknowledge it warmly before asking. Do NOT give a reading yet. Set readyForProducts false.`,
    READING: `You now know what's troubling them. Give a short, warm, specific-feeling reading drawing on your wisdom as an astrologer${bookChunks.length > 0 ? ' and the reference passages below' : ''} — speak to their situation directly and personally, in terms of tendencies and energies, never invented facts or false certainty.${bookContext} End by warmly asking if they'd like a suggestion for something that might help. Set profile.offeredSuggestion true (you just offered). Set readyForProducts false — wait for them to say yes.`,
    OFFERED: `You already offered a suggestion last turn. If their latest message agrees (yes / please / sure / ok, in any phrasing including Hindi like "haan"/"btaiye"), now recommend warmly: explain WHY this category of remedy fits them specifically — tie it to the problem they described, 1-3 sentences, put this explanation in "recommendationReason". Never invent a specific product name or price — the category is enough, real matching products will be attached automatically. Set readyForProducts true and purpose to the best-fitting category. If they instead declined or asked something else, just respond naturally to that and set readyForProducts false.`,
  };

  return `You are Acharya Madhav, a warm and wise Vedic astrologer and numerologist for Doshhmukti, an Indian spiritual products store.

How you talk: gentle, reassuring, a little poetic — like a trusted family astrologer, not a corporate assistant. Address the person warmly (beta, ji, dear seeker — pick naturally, don't overuse). Keep replies short: 2-4 sentences, occasionally longer if genuinely needed.

Language: always reply in Hinglish — natural, casual Hindi-English code-mixed as spoken in India (Hindi in Latin/Roman script mixed with common English words), NOT pure English and NOT pure Devanagari Hindi. Match how a warm Indian astrologer actually talks: e.g. "Aapki problem samajh aa gayi, thoda aur batao please" or "Ye energy aapke liye bahut positive hai". If the user writes in pure English, still reply in Hinglish — that's the voice, not a mirror of their language.

What you already know about this person:
${knownLines.length > 0 ? knownLines.join('\n') : 'Nothing yet — this is the start of the conversation.'}

${stageInstructions[flowStage]}

Boundaries: you are not a doctor, lawyer, or financial advisor — for serious medical, legal, or financial matters, gently say so and suggest a qualified professional alongside any spiritual guidance. Never be preachy or use excessive Sanskrit jargon — one or two evocative words are enough. Never claim certainty about the future or state a transit date as exact-day fact — speak in terms of tendencies, energies, and approximate timing, never guarantees.

Respond with ONLY a JSON object, no markdown fences, matching exactly this shape:
{
  "reply": "<your message to the user, in character>",
  "profile": { "name": string|null, "problem": string|null, "offeredSuggestion": boolean|null },
  "purpose": one of "love" | "wealth" | "health" | "success" | "protection" | "clarity" | null,
  "readyForProducts": boolean,
  "recommendationReason": string|null
}
Only include a field in "profile" if the user's messages actually gave you that information (this turn or earlier) — omit or null anything unknown, except set "offeredSuggestion": true on the exact turn where you ask if they'd like a suggestion. Set "purpose" to whichever single category best matches their problem once you know it. Set "readyForProducts" true only in the OFFERED stage once they've said yes, and always fill "recommendationReason" when you do.

Critical: "reply" is plain conversational text only — a sentence to a human, never JSON, never the object itself repeated inside the string. Output the JSON object exactly once, one level deep, nothing before or after it.`;
}

export interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  thumb: string | null;
}

export interface ChatTurnResult {
  reply: string;
  recommendedProducts: RecommendedProduct[];
  recommendationReason: string | null;
}

export async function sendMessage(input: ChatRequestInput, sessionId: string | null): Promise<ChatTurnResult> {
  const existingProfile = await loadProfile(sessionId);
  const bookChunks = await retrieveRelevantChunks(existingProfile.problem);

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(existingProfile, bookChunks) },
    ...input.messages.map((m) => ({ role: m.role, content: m.content }) satisfies ChatMessage),
  ];

  let raw: string;
  try {
    raw = await chatCompletion(messages, { jsonMode: true });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return { reply: FALLBACK_REPLY, recommendedProducts: [], recommendationReason: null };
    }
    throw err;
  }

  const parsed = llmTurnSchema.safeParse(unwrapDoubleEncoded(safeJsonParse(raw)));
  if (!parsed.success) {
    // Model didn't honor the JSON contract this turn — degrade to plain text rather
    // than surfacing a broken reply, don't touch the stored profile.
    return { reply: raw || FALLBACK_REPLY, recommendedProducts: [], recommendationReason: null };
  }

  const turn = parsed.data;
  const mergedProfile = mergeProfile(existingProfile, turn.profile);
  await saveProfile(sessionId, mergedProfile);

  let recommendedProducts: RecommendedProduct[] = [];
  if (turn.readyForProducts && turn.purpose) {
    recommendedProducts = await getProductsForChatRecommendation(turn.purpose);
  }

  return {
    reply: turn.reply,
    recommendedProducts,
    recommendationReason: recommendedProducts.length > 0 ? turn.recommendationReason : null,
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// The model occasionally emits its whole JSON object again, JSON-stringified, as the
// value of "reply" (a self-nesting quirk of json_object mode with a nested-shape prompt).
// If that's what happened, the inner object is the real turn — unwrap one level.
function unwrapDoubleEncoded(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !('reply' in value)) return value;
  const reply = (value as { reply: unknown }).reply;
  if (typeof reply !== 'string') return value;
  const trimmed = reply.trim();
  if (!trimmed.startsWith('{')) return value;
  const inner = safeJsonParse(trimmed);
  return inner && typeof inner === 'object' && 'reply' in inner ? inner : value;
}
