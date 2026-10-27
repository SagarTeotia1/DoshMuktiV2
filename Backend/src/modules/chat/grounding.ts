// Pure, dependency-free helpers for the Acharya chat: intent -> purpose mapping, catalog
// ranking, product grounding (model output -> real in-stock catalog rows), reply scrubbing,
// and user-input hardening. No DB / network / env imports so it is fully unit-testable
// (see Backend/tests/chat-grounding.test.mts).

import { PURPOSE_IDS, type PurposeId } from '../../shared/constants/purposes';

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  thumb: string | null;
  price: number; // lowest price among active, in-stock, non-service variants
  inStock: boolean;
  purposes: string[];
  categories: string[];
  tags: string[];
  featured: boolean;
  blurb: string; // short factual line built from the DB (benefits / excerpt)
}

// ── Intent -> purpose ─────────────────────────────────────────────────────────

// Hinglish + English keyword stems per purpose. A stem matches at a word start
// (so "shaadi" hits "shaadiyan"). Keywords with a trailing space also require a word end.
const INTENT_KEYWORDS: Record<PurposeId, string[]> = {
  love: [
    'love', 'pyar', 'prem', 'shaadi', 'shadi', 'vivah', 'marriage', 'rishta', 'rishte', 'relationship',
    'breakup', 'break up', 'partner', 'pati', 'patni', 'husband', 'wife', 'girlfriend', 'boyfriend',
    'crush', 'divorce', 'manglik', 'dampatya', 'ex ', 'attraction', 'romance',
  ],
  wealth: [
    'paisa', 'paise', 'dhan', 'money', 'wealth', 'debt', 'karz', 'karza', 'loan', 'business', 'vyapar',
    'dukan', 'income', 'kamai', 'salary', 'profit', 'nuksan', 'loss', 'lakshmi', 'laxmi', 'financial',
    'rich', 'barkat', 'barkati', 'cash',
  ],
  success: [
    'career', 'naukri', 'job', 'promotion', 'exam', 'padhai', 'study', 'student', 'interview', 'success',
    'safalta', 'competition', 'result', 'growth', 'rukavat', 'obstacle', 'blocked', 'stuck', 'kaam nahi',
  ],
  health: [
    'health', 'sehat', 'swasthya', 'bimar', 'bimari', 'illness', 'pain', 'dard', 'recover', 'immunity',
    'energy', 'thakan', 'fatigue', 'weak',
  ],
  protection: [
    'nazar', 'najar', 'buri nazar', 'evil eye', 'dosh', 'bhoot', 'pret', 'negative', 'negativity', 'suraksha',
    'protect', 'safety', 'gaadi', 'gadi', 'vehicle', 'car ', 'bike', 'accident', 'durghatna', 'darr', 'fear',
    'tona', 'totka', 'black magic', 'jaadu', 'vastu', 'ghar ki shanti', 'shatru', 'enemy', 'kaal sarp', 'shani',
    'rahu', 'ketu', 'sade sati', 'sadesati',
  ],
  clarity: [
    'confus', 'focus', 'overthink', 'anxiety', 'stress', 'tension', 'shanti', 'peace', 'mann', 'man ',
    'meditation', 'dhyan', 'decision', 'neend', 'sleep', 'calm', 'depress', 'udaas', 'udas', 'concentration',
    'clarity', 'spiritual',
  ],
  gifting: ['gift', 'tohfa', 'uphar', 'birthday', 'anniversary', 'present for'],
};

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

// Devanagari equivalents so a user typing in Hindi script still maps.
const DEVANAGARI_HINTS: Array<[string, PurposeId]> = [
  ['प्यार', 'love'], ['प्रेम', 'love'], ['शादी', 'love'], ['विवाह', 'love'], ['रिश्त', 'love'],
  ['धन', 'wealth'], ['पैसा', 'wealth'], ['पैसे', 'wealth'], ['कर्ज', 'wealth'], ['व्यापार', 'wealth'],
  ['नौकरी', 'success'], ['करियर', 'success'], ['परीक्षा', 'success'], ['सफलता', 'success'],
  ['स्वास्थ्य', 'health'], ['बीमार', 'health'], ['सेहत', 'health'],
  ['नज़र', 'protection'], ['नजर', 'protection'], ['दोष', 'protection'], ['सुरक्षा', 'protection'], ['शनि', 'protection'],
  ['शांति', 'clarity'], ['तनाव', 'clarity'], ['नींद', 'clarity'],
];

// Returns purposes ordered by strength of evidence (most hits first). Empty = no signal.
export function mapIntentToPurposes(text: string): PurposeId[] {
  if (!text) return [];
  const haystack = normalize(text);
  const scores = new Map<PurposeId, number>();
  for (const purpose of PURPOSE_IDS) {
    let score = 0;
    for (const kw of INTENT_KEYWORDS[purpose]) {
      const needle = ` ${kw.trim()}`;
      if (!haystack.includes(needle)) continue;
      if (kw.endsWith(' ') && !haystack.includes(`${needle} `)) continue;
      score += kw.includes(' ') ? 2 : 1;
    }
    if (score > 0) scores.set(purpose, score);
  }
  for (const [needle, purpose] of DEVANAGARI_HINTS) {
    if (text.includes(needle)) scores.set(purpose, (scores.get(purpose) ?? 0) + 1);
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
}

// ── Ranking ───────────────────────────────────────────────────────────────────

function tokens(text: string): string[] {
  return normalize(text).split(' ').filter((w) => w.length > 2);
}

// Scores one product for the given purposes + free text. Higher is better.
export function scoreProduct(p: CatalogProduct, purposes: string[], text: string): number {
  let score = 0;
  purposes.forEach((purpose, i) => {
    if (p.purposes.includes(purpose)) score += i === 0 ? 10 : i === 1 ? 5 : 2;
  });
  const words = new Set(tokens(text));
  const haystack = normalize(`${p.name} ${p.categories.join(' ')} ${p.tags.join(' ')} ${p.blurb}`);
  let overlap = 0;
  for (const w of words) if (haystack.includes(` ${w}`)) overlap += 1;
  score += Math.min(overlap, 4) * 2;
  if (p.featured) score += 1;
  return score;
}

// Hybrid rerank: purpose match + keyword overlap + featured. Out-of-stock products are
// never returned. Ties are broken by price ascending then name.
export function rankCatalog(
  catalog: CatalogProduct[],
  opts: { purposes: string[]; text: string; limit: number }
): CatalogProduct[] {
  return catalog
    .filter((p) => p.inStock && p.slug)
    .map((p) => ({ p, s: scoreProduct(p, opts.purposes, opts.text) }))
    .filter(({ s }) => s > 1)
    .sort((a, b) => b.s - a.s || a.p.price - b.p.price || a.p.name.localeCompare(b.p.name))
    .slice(0, opts.limit)
    .map(({ p }) => p);
}

// ── Grounding ─────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/^\/?products\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Resolves the model's product picks (slugs, or names it got slightly wrong) to REAL,
// in-stock catalog rows. Unknown / out-of-stock / duplicate picks are dropped. If nothing
// valid remains and `fallback` is given, the fallback (already ranked, in-stock) fills in.
export function groundProducts(
  requested: string[],
  catalog: CatalogProduct[],
  fallback: CatalogProduct[] = [],
  max = 3
): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  const seen = new Set<string>();
  const bySlug = new Map(catalog.map((p) => [p.slug, p]));
  const byName = new Map(catalog.map((p) => [slugify(p.name), p]));

  for (const raw of requested) {
    const key = slugify(raw);
    if (!key) continue;
    const hit = bySlug.get(key) ?? byName.get(key);
    if (!hit || !hit.inStock || seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push(hit);
    if (out.length >= max) return out;
  }
  if (out.length === 0) {
    for (const p of fallback) {
      if (!p.inStock || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
      if (out.length >= max) break;
    }
  }
  return out;
}

// ── Reply scrubbing ───────────────────────────────────────────────────────────

const FORBIDDEN_CLAIM =
  /\b(guarantee[ds]?|guaranty|100\s?%|gaaranti|gurantee|certain(ly)? (cure|result)s?|cures?|cured|permanent(ly)? (fix|solve|theek)|zaroor theek ho|pakka (result|fayda|kaam))\b/i;
const CURRENCY = /(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d+)?)|\b([\d,]+(?:\.\d+)?)\s?(?:rupees|rupay|rupaye)\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s)]+|\bwww\.[^\s)]+/gi;

export const SAFE_EMPTY_REPLY =
  'Main aapki baat dhyan se sun raha hoon. Thoda aur batayein — aap kis cheez se sabse zyada pareshaan hain?';

// Removes (a) sentences that promise guaranteed outcomes / cures, (b) rupee amounts the model
// typed that are not real prices of grounded products, (c) URLs that are not our own site.
export function scrubReply(reply: string, allowedPrices: number[] = [], siteHost = 'doshhmukti.com'): string {
  const allowed = new Set(allowedPrices.map((n) => Math.round(n)));
  const lines = reply.split('\n').map((line) => {
    const sentences = line.split(/(?<=[.!?।])\s+/);
    const kept = sentences.filter((s) => !FORBIDDEN_CLAIM.test(s));
    let joined = kept.join(' ');
    // Model sometimes leaks template placeholders ("[Name]", "{name}") when the name is unknown.
    joined = joined.replace(/\s*[[{<]\s*(?:name|naam|user|dob)\s*[\]}>][,!:]?/gi, '');
    joined = joined.replace(URL_RE, (u) => (u.toLowerCase().includes(siteHost) ? u : ''));
    joined = joined.replace(CURRENCY, (m, a?: string, b?: string) => {
      const n = Math.round(Number((a ?? b ?? '').replace(/,/g, '')));
      return allowed.has(n) ? m : '';
    });
    return joined.replace(/[ \t]{2,}/g, ' ').trim();
  });
  const cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned || SAFE_EMPTY_REPLY;
}

// ── Input hardening ───────────────────────────────────────────────────────────

// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const ROLE_MARKERS = /^\s*(system|assistant|developer|user)\s*:/gim;

export const MAX_USER_CHARS = 700;
export const MAX_ASSISTANT_HISTORY_CHARS = 500;

export function sanitizeUserText(text: string, max = MAX_USER_CHARS): string {
  return text
    .replace(CTRL, '')
    .replace(ROLE_MARKERS, '')
    .replace(/```/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, max);
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions?|prompts?|rules?)/i,
  /disregard (all |any )?(the )?(previous|prior|above|your) (instructions?|prompts?|rules?)/i,
  /(reveal|show|print|repeat|leak|tell me) (me )?(your|the) (system|hidden|initial|original) (prompt|instructions?|message)/i,
  /\b(system prompt|developer mode|jailbreak|dan mode)\b/i,
  /you are (now|no longer) (an? )?(?!acharya)/i,
  /pichle (saare )?(instructions?|niyam) (bhool|ignore)/i,
];

export function looksLikePromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

export const INJECTION_REPLY =
  'Main sirf Acharya Madhav hoon — aapki Kundli, Mulank aur upay ke baare me margdarshan de sakta hoon. Aap batayein, abhi aapko kis baat ki chinta hai?';

// ── Follow-up chips ───────────────────────────────────────────────────────────

export const DEFAULT_FOLLOW_UPS = ['Meri Kundli dekhein', 'Koi upay batayein', 'Product kaise use karein?'];

export function normalizeFollowUps(raw: unknown, fallback: string[] = []): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const t = item.replace(CTRL, '').replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 40 || /https?:|www\./i.test(t)) continue;
    // Chip is sent verbatim as the user's message — drop template placeholders like "[Name]" or "{name}".
    if (/[[\]{}<>]/.test(t)) continue;
    if (out.some((o) => o.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
    if (out.length >= 3) break;
  }
  return out.length > 0 ? out : fallback.slice(0, 3);
}

// Caps a reply so it never renders as a wall of text even if the model ignores the length rule.
export function capReply(reply: string, maxChars = 700): string {
  if (reply.length <= maxChars) return reply;
  const cut = reply.slice(0, maxChars);
  const lastBreak = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastBreak > maxChars * 0.5 ? cut.slice(0, lastBreak + 1) : cut).trim();
}
