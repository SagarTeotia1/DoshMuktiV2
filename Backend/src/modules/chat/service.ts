import { chatCompletion, GroqNotConfiguredError, type ChatMessage } from '../../shared/integrations/groq/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import { lookupGeo } from '../../shared/integrations/geoip/client';
import { getChatCatalog } from '../products/service';
import { retrieveRelevantChunks } from './bookRetrieval';
import { computeKundliFacts, extractDobFromText, extractPhoneFromText } from './astrology';
import { buildSystemPrompt } from './prompt';
import { canShowProducts, MAX_RECOMMENDED_PRODUCTS, wantsProducts } from './intent';
import {
  DEFAULT_FOLLOW_UPS,
  INJECTION_REPLY,
  MAX_ASSISTANT_HISTORY_CHARS,
  MAX_USER_CHARS,
  capReply,
  groundProducts,
  looksLikePromptInjection,
  mapIntentToPurposes,
  normalizeFollowUps,
  rankCatalog,
  sanitizeUserText,
  scrubReply,
  type CatalogProduct,
} from './grounding';
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

export interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  thumb: string | null;
  price: number; // real current price in INR, from the catalog (never from the model)
  inStock: boolean;
}

export interface ChatTurnResult {
  reply: string;
  recommendedProducts: RecommendedProduct[];
  recommendationReason: string | null;
  followUps: string[];
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

const MAX_PROMPT_HISTORY = 12;
const SECOND_TURN_FOLLOW_UPS = ['Ise kaise use karein?', 'Mujhe thoda aur samjhayein', 'Meri Kundli dekhein'];

function buildHistory(input: ChatRequestInput): ChatMessage[] {
  // Client-supplied assistant turns are unverifiable, so they are truncated harder than user turns.
  return input.messages
    .slice(-MAX_PROMPT_HISTORY)
    .map((m) => ({
      role: m.role,
      content: sanitizeUserText(m.content, m.role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_HISTORY_CHARS),
    }))
    .filter((m) => m.content.length > 0);
}

function toRecommended(p: CatalogProduct): RecommendedProduct {
  return { id: p.id, name: p.name, slug: p.slug, thumb: p.thumb, price: Math.round(p.price), inStock: true };
}

async function loadCatalog(): Promise<CatalogProduct[]> {
  try {
    return await getChatCatalog();
  } catch (err) {
    console.error('[chat] catalog load failed, replying without product grounding', err);
    return [];
  }
}

function fallbackResult(reply: string): ChatTurnResult {
  return { reply, recommendedProducts: [], recommendationReason: null, followUps: DEFAULT_FOLLOW_UPS };
}

async function sendMessageInner(input: ChatRequestInput, sessionId: string | null, ip: string): Promise<ChatTurnResult> {
  const existingProfile = await loadProfile(sessionId);

  const lastUserMessage = input.messages[input.messages.length - 1];
  const cleanedLast = sanitizeUserText(lastUserMessage?.content ?? '');

  // Prompt-injection attempts never reach the model (no cost, no leak surface).
  if (looksLikePromptInjection(cleanedLast)) return fallbackResult(INJECTION_REPLY);

  let textExtractedDob: string | null = null;
  let textExtractedPhone: string | null = null;
  const dobMatch = extractDobFromText(cleanedLast);
  if (dobMatch) textExtractedDob = dobMatch.dob.toISOString().slice(0, 10);
  const phoneMatch = extractPhoneFromText(cleanedLast);
  if (phoneMatch) textExtractedPhone = phoneMatch;

  const activeDob = textExtractedDob || existingProfile.dob;
  const activePhone = textExtractedPhone || existingProfile.phone;

  const preMergedProfile: ChatProfile = {
    ...existingProfile,
    dob: activeDob,
    phone: activePhone,
    phoneCollected: Boolean(activePhone || existingProfile.phoneCollected),
  };

  const kundliFacts = activeDob ? computeKundliFacts(activeDob) : null;

  // Intent text: the last few user turns plus the stored problem, so a short "haan" or
  // "mera DOB ..." reply still keeps the original concern in scope.
  const userTurns = input.messages.filter((m) => m.role === 'user');
  const intentText = [preMergedProfile.problem ?? '', ...userTurns.slice(-3).map((m) => sanitizeUserText(m.content, 300))]
    .join(' ')
    .trim();
  const intentPurposes = mapIntentToPurposes(intentText);

  const [catalog, bookChunks] = await Promise.all([
    loadCatalog(),
    retrieveRelevantChunks(intentText.slice(0, 400) || null),
  ]);
  const candidates = rankCatalog(catalog, { purposes: intentPurposes, text: intentText, limit: 8 });

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt({
        profile: preMergedProfile,
        bookChunks,
        kundliFacts,
        candidates,
        turnNumber: userTurns.length,
      }),
    },
    ...buildHistory(input),
  ];

  let raw: string;
  try {
    raw = await chatCompletion(messages, { jsonMode: true });
  } catch (err) {
    if (!(err instanceof GroqNotConfiguredError)) console.error('[chat] LLM call failed', err);
    return fallbackResult(FALLBACK_REPLY);
  }

  const parsedInput = unwrapDoubleEncoded(safeJsonParse(raw));
  const parsed = llmTurnSchema.safeParse(parsedInput);
  if (!parsed.success) {
    console.error('[chat] LLM response failed schema validation', parsed.error.flatten());
    const salvagedReply =
      parsedInput && typeof parsedInput === 'object' && typeof (parsedInput as { reply?: unknown }).reply === 'string'
        ? ((parsedInput as { reply: string }).reply.trim() || null)
        : null;
    return fallbackResult(salvagedReply ? capReply(scrubReply(salvagedReply)) : FALLBACK_REPLY);
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

  if (finalPhone) {
    void saveLeadToDatabase(sessionId, finalPhone, mergedProfile, turn.purpose, ip);
  }

  // Grounding: only real, in-stock catalog rows survive. Guidance-first: cards appear only when
  // the visitor asked for something to buy/do, or after a few turns when the model is ready.
  // Our own purpose-ranked fallback picks are used only on an explicit ask.
  const asked = wantsProducts(userTurns.slice(-2).map((m) => sanitizeUserText(m.content, 300)).join(' '));
  const showProducts = canShowProducts({ asked, userTurns: userTurns.length, modelReady: turn.readyForProducts });
  const purposeOrder = [...(turn.purpose ? [turn.purpose] : []), ...intentPurposes];
  const fallbackPicks = asked ? rankCatalog(catalog, { purposes: purposeOrder, text: intentText, limit: MAX_RECOMMENDED_PRODUCTS }) : [];
  const grounded = showProducts ? groundProducts(turn.suggestedSlugs, catalog, fallbackPicks, MAX_RECOMMENDED_PRODUCTS) : [];
  const recommendedProducts = grounded.map(toRecommended);

  const reply = capReply(scrubReply(turn.reply, grounded.map((p) => p.price)));
  return {
    reply,
    recommendedProducts,
    recommendationReason: recommendedProducts.length > 0 ? turn.recommendationReason : null,
    followUps: normalizeFollowUps(turn.followUps, recommendedProducts.length > 0 ? SECOND_TURN_FOLLOW_UPS : DEFAULT_FOLLOW_UPS),
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
