import { chatCompletion, GroqNotConfiguredError, type ChatMessage } from '../../shared/integrations/groq/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import { lookupGeo } from '../../shared/integrations/geoip/client';
import { getProductsForChatRecommendation } from '../products/service';
import { retrieveRelevantChunks, type RetrievedChunk } from './bookRetrieval';
import {
  computeKundliFacts,
  extractDobFromText,
  extractPhoneFromText,
  formatKundliFactsForPrompt,
  type KundliFacts,
} from './astrology';
import { normalizePhone } from '../../shared/utils/phone';
import { db } from '../../shared/db/client';
import {
  EMPTY_PROFILE,
  llmTurnSchema,
  type ChatProfile,
  type ChatRequestInput,
  type ChatSessionRecord,
} from './schema';

const FALLBACK_REPLY =
  "Acharya Madhav is resting for a moment — please try again shortly, or reach us on WhatsApp for immediate guidance.";

async function loadProfile(sessionId: string | null): Promise<ChatProfile> {
  if (!sessionId) return EMPTY_PROFILE;
  try {
    const cached = await redis.get<ChatProfile>(cacheKeys.chatProfile(sessionId));
    return cached ?? EMPTY_PROFILE;
  } catch (err) {
    console.error('[chat] failed to load profile', err);
    return EMPTY_PROFILE;
  }
}

async function saveProfile(sessionId: string | null, profile: ChatProfile): Promise<void> {
  if (!sessionId) return;
  try {
    await redis.set(cacheKeys.chatProfile(sessionId), profile, { ex: CACHE_TTL.CHAT_PROFILE });
  } catch (err) {
    console.error('[chat] failed to persist profile', err);
  }
}

function mergeProfile(existing: ChatProfile, incoming: Partial<ChatProfile>): ChatProfile {
  const phone = incoming.phone ?? existing.phone;
  return {
    name: incoming.name ?? existing.name,
    dob: incoming.dob ?? existing.dob,
    phone,
    problem: incoming.problem ?? existing.problem,
    offeredSuggestion: incoming.offeredSuggestion ?? existing.offeredSuggestion,
    askedForPhone: incoming.askedForPhone ?? existing.askedForPhone,
    phoneCollected: incoming.phoneCollected ?? (phone ? true : existing.phoneCollected),
  };
}

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

function buildSystemPrompt(
  profile: ChatProfile,
  bookChunks: RetrievedChunk[],
  kundliFacts: KundliFacts | null
): string {
  const knownLines = [
    profile.name ? `Name: ${profile.name}` : null,
    profile.dob ? `Date of Birth: ${profile.dob}` : null,
    profile.phone ? `Phone / WhatsApp: ${profile.phone}` : null,
    profile.problem ? `What's troubling them: ${profile.problem}` : null,
  ].filter(Boolean);

  const bookContext =
    bookChunks.length > 0
      ? `\n\nRelevant passages from reference texts:\n${bookChunks.map((c) => `- ${sanitizeForPrompt(c.content)}`).join('\n')}\n\nGround your remedy/mantra in these passages where relevant — paraphrase naturally.`
      : '';

  const kundliContext = kundliFacts ? `\n\n${formatKundliFactsForPrompt(kundliFacts)}` : '';

  return `You are Acharya Madhav, a warm, wise, modern Vedic astrologer and numerologist for Doshhmukti (an Indian spiritual store). You speak like a trusted, enlightened guide and wise friend who has deep mastery over Jyotish, Kundli, and Numerology.

VOICE & TONE:
- Gentle, grounded, empathetic, deeply insightful and authentic.
- Always reply in natural Hinglish (Hindi written in Roman/Latin alphabet mixed with common conversational English words, as spoken in India). E.g., "Aapki janma tithi dekhkar aapke grahon ki sthiti samajh aa rahi hai", "Dil ke bahut saaf hain aap, par log aksar kadar nahi karte".
- Never be dry, robotic, or preachy. Address the seeker warmly.

CORE ASTROLOGICAL & KUNDLI GUIDELINES:
1. When Date of Birth (DOB) is available (or user shares their birth date in this turn):
   - You MUST refer to the verified Kundli facts provided below.
   - Reveal 2-3 uncanny, deeply relatable facts about their personality, life struggles, and tendencies (e.g. Mulank ruling planet personality trait, relationship truth where they help others but don't get appreciation, inner overthinking/decision struggle, lucky day/color).
   - This creates an authentic, captivating, deeply real astrological connection ("real feel").
   - Connect their ruling Graha (planet) and planetary energy to why they are facing their current challenge.
2. If DOB is NOT yet provided:
   - When addressing their question or problem, warmly invite them to share their Date of Birth (janma tithi) if they like:
     "Aap chahein toh apni Date of Birth (janma tithi) batayein, taaki main aapki Kundli aur Mulank dekhkar bilkul accurate graha sthiti aur specific upay bata sakun."

PHONE NUMBER CAPTURE (BAATO-BAATO ME PHONE NUMBER MANGNA):
- Organically and conversationally, ask for their WhatsApp/Phone number so you can send them their detailed Kundli analysis report and daily remedies:
  E.g.: "Aapki poori Kundli report, shubh muhurat aur daily dhyan vidhi ko main aapke WhatsApp par bhi bhej dunga — aap apna WhatsApp/phone number share kar dijiye."
- If the user has just provided their phone number in this turn:
  Warmly acknowledge and confirm:
  "Dhanyawad! Maine aapka WhatsApp number note kar liya hai. Aapki personalized Kundli report aur poore upay humari team jald hi WhatsApp par bhej degi. 🙏"
  Mark "phoneCollected": true in profile.
- If phone is already collected, do NOT ask for it again.

REMEDY & RECOMMENDATIONS:
- Structure your response as short, separate lines (use literal \\n between each part, never one dense block):
  1. One short line naming the planetary energy/Mulank tendency behind their situation.
  2. A remedy line, clearly marked with:
     🕉️ Mantra: <the specific Beej Mantra or Shloka>
     🪔 Kriya: <simple practical act or precaution, 1 short sentence>
  3. One closing line hinting that an energized spiritual remedy item can help them further (CRITICAL: do NOT invent or name any specific product name, as real matching products are attached below automatically).
  4. Set readyForProducts: true with purpose set to the best-fitting category ("love" | "wealth" | "health" | "success" | "protection" | "clarity") and recommendationReason filled with a concise 1-2 sentence reason.

Keep the whole reply tight — 3 to 5 short lines total.

${knownLines.length > 0 ? `Known about the user:\n${knownLines.join('\n')}` : 'No prior details known yet.'}
${kundliContext}
${bookContext}

Respond with ONLY a valid JSON object matching exactly this shape:
{
  "reply": "<your Hinglish reply to the user, with literal \\n between short lines>",
  "profile": {
    "name": string|null,
    "dob": string|null,
    "phone": string|null,
    "problem": string|null,
    "offeredSuggestion": boolean|null,
    "askedForPhone": boolean|null,
    "phoneCollected": boolean|null
  },
  "purpose": "love" | "wealth" | "health" | "success" | "protection" | "clarity" | null,
  "readyForProducts": boolean,
  "recommendationReason": string|null
}
Output the JSON object exactly once, nothing before or after it.`;
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

async function recordChatTurn(
  sessionId: string | null,
  ip: string,
  userMessage: string,
  assistantReply: string,
  profile: ChatProfile
): Promise<void> {
  if (!sessionId) return;
  try {
    const key = cacheKeys.chatSession(sessionId);
    const existing = await redis.get<ChatSessionRecord>(key);
    const now = new Date().toISOString();
    const geo = existing ? { city: existing.city, country: existing.country } : await lookupGeo(ip);

    const record: ChatSessionRecord = {
      sessionId,
      ip,
      phone: profile.phone ?? existing?.phone ?? null,
      name: profile.name ?? existing?.name ?? null,
      dob: profile.dob ?? existing?.dob ?? null,
      problem: profile.problem ?? existing?.problem ?? null,
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

async function saveLeadToDatabase(
  sessionId: string | null,
  phone: string,
  profile: ChatProfile,
  purpose: string | null,
  ip: string
): Promise<void> {
  try {
    const normalized = normalizePhone(phone);
    const geo = await lookupGeo(ip);

    const existingLead = await db.chatLead.findFirst({
      where: {
        OR: [
          ...(sessionId ? [{ sessionId }] : []),
          { phone: normalized },
        ],
      },
    });

    if (existingLead) {
      await db.chatLead.update({
        where: { id: existingLead.id },
        data: {
          phone: normalized,
          name: profile.name || existingLead.name,
          dob: profile.dob || existingLead.dob,
          problem: profile.problem || existingLead.problem,
          purpose: purpose || existingLead.purpose,
          city: geo.city || existingLead.city,
          country: geo.country || existingLead.country,
          notes: profile.problem ? `Problem: ${profile.problem}` : existingLead.notes,
        },
      });
    } else {
      await db.chatLead.create({
        data: {
          sessionId,
          phone: normalized,
          name: profile.name || null,
          dob: profile.dob || null,
          problem: profile.problem || null,
          purpose: purpose || null,
          city: geo.city || null,
          country: geo.country || null,
          notes: profile.problem ? `Problem: ${profile.problem}` : null,
        },
      });
    }
  } catch (err) {
    console.error('[chat] failed to save lead to database', err);
  }
}

export async function sendMessage(input: ChatRequestInput, sessionId: string | null, ip = 'unknown'): Promise<ChatTurnResult> {
  const result = await sendMessageInner(input, sessionId, ip);
  const lastUserMessage = input.messages[input.messages.length - 1];
  const profile = await loadProfile(sessionId);
  if (lastUserMessage) void recordChatTurn(sessionId, ip, lastUserMessage.content, result.reply, profile);
  return result;
}

async function sendMessageInner(input: ChatRequestInput, sessionId: string | null, ip: string): Promise<ChatTurnResult> {
  const existingProfile = await loadProfile(sessionId);

  // Extract DOB and phone from the latest user message
  const lastUserMessage = input.messages[input.messages.length - 1];
  let textExtractedDob: string | null = null;
  let textExtractedPhone: string | null = null;

  if (lastUserMessage && lastUserMessage.role === 'user') {
    const dobMatch = extractDobFromText(lastUserMessage.content);
    if (dobMatch) {
      textExtractedDob = dobMatch.dob.toISOString().slice(0, 10);
    }
    const phoneMatch = extractPhoneFromText(lastUserMessage.content);
    if (phoneMatch) {
      textExtractedPhone = phoneMatch;
    }
  }

  const activeDob = textExtractedDob || existingProfile.dob;
  const activePhone = textExtractedPhone || existingProfile.phone;

  const preMergedProfile: ChatProfile = {
    ...existingProfile,
    dob: activeDob,
    phone: activePhone,
    phoneCollected: Boolean(activePhone || existingProfile.phoneCollected),
  };

  const kundliFacts = activeDob ? computeKundliFacts(activeDob) : null;
  const bookChunks = await retrieveRelevantChunks(preMergedProfile.problem);

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(preMergedProfile, bookChunks, kundliFacts) },
    ...input.messages.map((m) => ({ role: m.role, content: m.content }) satisfies ChatMessage),
  ];

  let raw: string;
  try {
    raw = await chatCompletion(messages, { jsonMode: true });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      return { reply: FALLBACK_REPLY, recommendedProducts: [], recommendationReason: null };
    }
    console.error('[chat] LLM call failed', err);
    return { reply: FALLBACK_REPLY, recommendedProducts: [], recommendationReason: null };
  }

  const parsedInput = unwrapDoubleEncoded(safeJsonParse(raw));
  const parsed = llmTurnSchema.safeParse(parsedInput);
  if (!parsed.success) {
    console.error('[chat] LLM response failed schema validation', parsed.error.flatten());
    const salvagedReply =
      parsedInput && typeof parsedInput === 'object' && typeof (parsedInput as { reply?: unknown }).reply === 'string'
        ? ((parsedInput as { reply: string }).reply.trim() || null)
        : null;
    return { reply: salvagedReply ?? FALLBACK_REPLY, recommendedProducts: [], recommendationReason: null };
  }

  const turn = parsed.data;
  const finalPhone = textExtractedPhone || turn.profile.phone || preMergedProfile.phone;
  const finalDob = textExtractedDob || turn.profile.dob || preMergedProfile.dob;

  const mergedProfile = mergeProfile(preMergedProfile, {
    ...turn.profile,
    phone: finalPhone,
    dob: finalDob,
  });
  await saveProfile(sessionId, mergedProfile);

  // If phone number is available, save/upsert lead into database
  if (finalPhone) {
    void saveLeadToDatabase(sessionId, finalPhone, mergedProfile, turn.purpose, ip);
  }

  let recommendedProducts: RecommendedProduct[] = [];
  if (turn.readyForProducts && turn.purpose) {
    try {
      recommendedProducts = await getProductsForChatRecommendation(turn.purpose);
    } catch (err) {
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

function unwrapDoubleEncoded(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || !('reply' in value)) return value;
  const reply = (value as { reply: unknown }).reply;
  if (typeof reply !== 'string') return value;
  const trimmed = reply.trim();
  if (!trimmed.startsWith('{')) return value;
  const inner = safeJsonParse(trimmed);
  return inner && typeof inner === 'object' && 'reply' in inner ? inner : value;
}
