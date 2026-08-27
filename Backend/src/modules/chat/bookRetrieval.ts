// Keyword-based retrieval over BookChunk, used to ground Acharya Madhav's replies in the
// owner's reference book once it's ingested (see Backend/scripts/ingest-book.ts). No
// vector/embedding infra exists in this stack yet, so this is intentionally simple:
// extract a handful of meaningful words from the user's stated problem, then rank chunks
// by how many of those words they contain via a parameterized $queryRaw (never raw string
// concatenation). Returns [] when nothing is ingested yet or nothing matches — that's the
// expected "no book content yet" state, not an error, and callers must fall back gracefully.

import { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'so', 'to', 'of', 'in', 'on', 'at',
  'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'from', 'up', 'down', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall', 'should',
  'can', 'could', 'may', 'might', 'must', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he',
  'she', 'it', 'its', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'not',
  'no', 'nor', 'as', 'because', 'am', 'im', 'having', 'get', 'got', 'like', 'just', 'also',
  'very', 'much', 'lot', 'bahut', 'hai', 'mera', 'meri', 'mujhe', 'main', 'mai', 'ho', 'hoon',
  'kya', 'aur', 'ka', 'ki', 'ke', 'se', 'ko',
]);

const MAX_KEYWORDS = 8;
const MAX_CHUNKS = 4;

// Extracts up to MAX_KEYWORDS meaningful words from free-form problem text.
function extractKeywords(problem: string): string[] {
  const words = problem
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  // De-dupe while preserving order, cap at MAX_KEYWORDS.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      unique.push(w);
    }
    if (unique.length >= MAX_KEYWORDS) break;
  }
  return unique;
}

export interface RetrievedChunk {
  id: string;
  source: string;
  content: string;
}

interface ScoredChunkRow {
  id: string;
  source: string;
  content: string;
  score: bigint | number;
}

// Given the user's stated problem, returns up to MAX_CHUNKS relevant BookChunk passages,
// most-relevant first (ranked by keyword match count). Returns [] if no keywords could be
// extracted, if no BookChunk rows exist at all, or if nothing matches — every one of those
// is the expected "no grounding available" state, not an error.
export async function retrieveRelevantChunks(problem: string | null | undefined): Promise<RetrievedChunk[]> {
  if (!problem || !problem.trim()) return [];

  const keywords = extractKeywords(problem);
  if (keywords.length === 0) return [];

  const totalChunks = await db.bookChunk.count();
  if (totalChunks === 0) return [];

  // Sum of per-keyword ILIKE matches, each a safely parameterized pattern (never string
  // concatenation) — a naive but effective relevance score with no embedding infra.
  const scoreTerms = keywords.map(
    (kw) => Prisma.sql`(CASE WHEN content ILIKE ${'%' + kw + '%'} THEN 1 ELSE 0 END)`
  );
  const scoreExpr = Prisma.join(scoreTerms, ' + ');

  const rows = await db.$queryRaw<ScoredChunkRow[]>(Prisma.sql`
    SELECT id, source, content, (${scoreExpr}) AS score
    FROM "BookChunk"
    WHERE (${scoreExpr}) > 0
    ORDER BY score DESC, "createdAt" DESC
    LIMIT ${MAX_CHUNKS}
  `);

  return rows.map((r) => ({ id: r.id, source: r.source, content: r.content }));
}
