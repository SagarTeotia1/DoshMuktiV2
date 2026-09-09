import { chatCompletion, GroqNotConfiguredError, type ChatMessage } from '../../shared/integrations/groq/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import { lookupGeo } from '../../shared/integrations/geoip/client';
import { getProductsForChatRecommendation } from '../products/service';
import { retrieveRelevantChunks, type RetrievedChunk } from './bookRetrieval';
import { EMPTY_PROFILE, llmTurnSchema, type ChatProfile, type ChatRequestInput, type ChatSessionRecord } from './schema';

const FALLBACK_REPLY =
  "Acharya Madhav is resting for a moment — please try again shortly, or reach us on WhatsApp for immediate guidance.";

async function loadProfile(sessionId: string | null): Promise<ChatProfile> {
  if (!sessionId) return EMPTY_PROFILE;
  try {
    const cached = await redis.get<ChatProfile>(cacheKeys.chatProfile(sessionId));
    return cached ?? EMPTY_PROFILE;
  } catch (err) {
    // Degrade to a fresh profile rather than failing the whole turn over a Redis hiccup —
    // worst case the model re-asks something it already knew.
    console.error('[chat] failed to load profile', err);
    return EMPTY_PROFILE;
  }
}

async function saveProfile(sessionId: string | null, profile: ChatProfile): Promise<void> {
  if (!sessionId) return;
  try {
    await redis.set(cacheKeys.chatProfile(sessionId), profile, { ex: CACHE_TTL.CHAT_PROFILE });
  } catch (err) {
    // A Redis hiccup here means the next turn re-asks something already answered —
    // annoying, not a reason to fail a reply that was already generated successfully.
    console.error('[chat] failed to persist profile', err);
  }
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

// OCR'd book text occasionally contains control characters or unpaired UTF-16 surrogates
// (Tesseract misreads on Devanagari conjuncts) — these survive JSON.stringify but produce
// invalid UTF-8 bytes over the wire, which the LLM provider's API rejects as "invalid json" on the
// request body. Strip them before any book passage reaches the outgoing prompt.
const CONTROL_CHARS = new RegExp(
  '[' + String.fromCharCode(0) + '-' + String.fromCharCode(8) +
  String.fromCharCode(11) + String.fromCharCode(12) +
  String.fromCharCode(14) + '-' + String.fromCharCode(31) +
  String.fromCharCode(127) + ']',
  'g'
);
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g;

function sanitizeForPrompt(text: string): string {
  return text.replace(CONTROL_CHARS, '').replace(LONE_SURROGATE, '').trim();
}

function buildSystemPrompt(profile: ChatProfile, bookChunks: RetrievedChunk[]): string {
  const knownLines = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.problem ? `What's troubling them: ${profile.problem}` : null,
  ].filter(Boolean);

  const flowStage = !profile.problem ? 'GATHERING' : 'REMEDY';

  const bookContext =
    bookChunks.length > 0
      ? `\n\nRelevant passages from your reference text:\n${bookChunks.map((c) => `- ${sanitizeForPrompt(c.content)}`).join('\n')}\n\nGround your remedy/mantra in these passages where relevant — paraphrase them naturally in your own voice, never quote verbatim or robotically, never mention "passages" or "reference text" to the user.`
      : '';

  const stageInstructions: Record<typeof flowStage, string> = {
    GATHERING: `Still need to know what's troubling them. Ask for it naturally, warmly — never a cold form-like question. If they've shared something else first, acknowledge it warmly before asking. Do NOT give a reading or remedy yet. Set readyForProducts false.`,
    REMEDY: `You now know what's troubling them — give the full remedy in THIS turn, don't wait for them to ask for more or to say yes to anything. Structure "reply" as short, separate lines (use literal \\n between each part, never one dense paragraph):
1. One short line naming the energy/tendency behind their situation — warm, specific-feeling, never invented facts or false certainty${bookChunks.length > 0 ? ', drawing on the reference passages below where relevant' : ''}.${bookContext}
2. A remedy line, clearly marked. PRIORITY ORDER: if the reference passages above contain or imply a mantra for this kind of problem, give that mantra — mark it "🕉️ Mantra: <the mantra>". If the reference passages don't have a mantra but describe a kriya/ritual/practice (a totka, a specific act to perform), give that instead — mark it "🪔 Kriya: <the practice, in 1 short sentence>". Only if the passages have neither, fall back to your own general astrological wisdom for a short mantra — still mark it "🕉️ Mantra: <the mantra>". Never invent a "reference passage" that isn't there — this priority is about which the retrieved text actually supports, not about pretending certainty either way.
3. One closing line mentioning that a specific remedy item can help them further, in the same warm voice (e.g. "Aur beta, ek cheez hai jo isme aapki madad karegi —"), and set readyForProducts true with purpose set to the best-fitting category and recommendationReason filled with a short 1-2 sentence reason tying that category to their problem. Never invent a specific product name or price — the category is enough, real matching products are attached automatically.
Keep the whole reply tight — 3 short lines total, never a wall of text. If they reply again after this (thanking you, asking a follow-up, asking for another remedy), keep replying warmly in the same short-lines style, mantra still front and center whenever relevant, and readyForProducts true again if it fits.`,
  };

  return `You are Acharya Madhav, a warm, modern Vedic astrologer and numerologist for Doshhmukti, an Indian spiritual products store — think a wise friend who happens to know the old texts deeply, not a temple priest reciting scripture.

How you talk: gentle, grounded, a little playful when it fits — deep and genuinely helpful, never preachy, never a wall of "beta this, beta that" piety. Address the person warmly but don't overdo the endearments. Keep replies short: 2-4 sentences, occasionally longer only when a remedy genuinely needs it.

Language: always reply in Hinglish — natural, casual Hindi-English code-mixed as spoken in India (Hindi in Latin/Roman script mixed with common English words), NOT pure English and NOT pure Devanagari Hindi. Match how a sharp, modern Indian astrologer actually talks: e.g. "Aapki problem samajh aa gayi, thoda aur batao please" or "Ye energy aapke liye bahut positive hai". If the user writes in pure English, still reply in Hinglish — that's the voice, not a mirror of their language.

Critical — never ask for personal details: never ask the user's name, date of birth, age, or occupation/work, and never make giving a reading conditional on getting any of these. You read energy and intention from what they tell you about their problem, not from birth charts requiring exact data. If they volunteer their name unprompted, you may use it warmly — never solicit it.

What you already know about this person:
${knownLines.length > 0 ? knownLines.join('\n') : 'Nothing yet — this is the start of the conversation.'}

${stageInstructions[flowStage]}

Boundaries: you are not a doctor, lawyer, or financial advisor — for serious medical, legal, or financial matters, gently say so and suggest a qualified professional alongside any spiritual guidance. Never be preachy or use excessive Sanskrit jargon — one or two evocative words are enough. Never claim certainty about the future or state a transit date as exact-day fact — speak in terms of tendencies, energies, and approximate timing, never guarantees.

Respond with ONLY a JSON object, no markdown fences, matching exactly this shape:
{
  "reply": "<your message to the user, in character — use literal \\n between the short lines described above>",
  "profile": { "name": string|null, "problem": string|null },
  "purpose": one of "love" | "wealth" | "health" | "success" | "protection" | "clarity" | null,
  "readyForProducts": boolean,
  "recommendationReason": string|null
}
Only include a field in "profile" if the user's messages actually gave you that information (this turn or earlier) — omit or null anything unknown. Set "purpose" to whichever single category best matches their problem once you know it. Set "readyForProducts" true whenever you give a remedy (per the REMEDY stage instructions above), and always fill "recommendationReason" when you do.

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

const MAX_LOGGED_MESSAGES = 40;

// Admin visibility only (see the "god's eye view" ask) — a capped, TTL'd transcript +
// one geo lookup per session, best-effort and never allowed to affect the actual chat
// reply. Skipped entirely when there's no sessionId (nothing to key the record under —
// same rule loadProfile/saveProfile already follow).
async function recordChatTurn(sessionId: string | null, ip: string, userMessage: string, assistantReply: string): Promise<void> {
  if (!sessionId) return;
  try {
    const key = cacheKeys.chatSession(sessionId);
    const existing = await redis.get<ChatSessionRecord>(key);
    const now = new Date().toISOString();
    const geo = existing ? { city: existing.city, country: existing.country } : await lookupGeo(ip);

    const record: ChatSessionRecord = {
      sessionId,
      ip,
      city: geo.city,
      country: geo.country,
      startedAt: existing?.startedAt ?? now,
      lastMessageAt: now,
      messages: [
        ...(existing?.messages ?? []),
        { role: 'user' as const, content: userMessage, at: now },
        { role: 'assistant' as const, content: assistantReply, at: now },
      ].slice(-MAX_LOGGED_MESSAGES),
    };
    await redis.set(key, record, { ex: CACHE_TTL.CHAT_SESSION });
  } catch (err) {
    console.error('[chat] failed to record session transcript', err);
  }
}

export async function sendMessage(input: ChatRequestInput, sessionId: string | null, ip = 'unknown'): Promise<ChatTurnResult> {
  const result = await sendMessageInner(input, sessionId);
  const lastUserMessage = input.messages[input.messages.length - 1];
  if (lastUserMessage) void recordChatTurn(sessionId, ip, lastUserMessage.content, result.reply);
  return result;
}

async function sendMessageInner(input: ChatRequestInput, sessionId: string | null): Promise<ChatTurnResult> {
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
    // Never surface a raw provider failure (rate limit, malformed-request, transient
    // 5xx) to the user — degrade to the in-character fallback line instead.
    if (err instanceof GroqNotConfiguredError) {
      return { reply: FALLBACK_REPLY, recommendedProducts: [], recommendationReason: null };
    }
    console.error('[chat] OpenRouter call failed', err);
    return { reply: FALLBACK_REPLY, recommendedProducts: [], recommendationReason: null };
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
    try {
      recommendedProducts = await getProductsForChatRecommendation(turn.purpose);
    } catch (err) {
      // A DB hiccup fetching product cards must never fail the whole chat turn — the
      // remedy/mantra text is still valid and worth showing on its own.
      console.error('[chat] product recommendation lookup failed, replying without cards', err);
    }
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
