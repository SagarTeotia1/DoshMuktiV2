// Retrieval over BookChunk, used to ground Acharya Madhav's replies in the owner's
// reference book once it's ingested (see Backend/scripts/ingest-book.ts).
//
// Primary path: vector similarity search. The user's problem text is embedded with the same
// local Transformers.js model used at ingestion time (src/shared/ai/embeddings.ts — free,
// in-process, no external API), then BookChunk rows are ranked by pgvector cosine distance
// via a parameterized $queryRaw. Restricted to `embedding IS NOT NULL` so it only considers
// rows that actually have one.
//
// Fallback path: the original keyword/ILIKE scoring, used when the embedding pipeline fails
// to load/run, or simply to catch chunks with no embedding (ingested before this existed).
// Both paths return [] when nothing is ingested yet or nothing matches — that's the expected
// "no book content yet" state, not an error, and callers must fall back gracefully.

import { Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { embedText, toVectorLiteral } from '../../shared/ai/embeddings';

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

interface VectorChunkRow {
  id: string;
  source: string;
  content: string;
  distance: number;
}

// Given the user's stated problem, returns up to MAX_CHUNKS relevant BookChunk passages,
// most-relevant first. Tries vector similarity search first; falls back to keyword scoring
// if the embedding pipeline errors or no BookChunk rows exist. Returns [] if no BookChunk
// rows exist at all, or if nothing matches either path — every one of those is the expected
// "no grounding available" state, not an error.
export async function retrieveRelevantChunks(problem: string | null | undefined): Promise<RetrievedChunk[]> {
  if (!problem || !problem.trim()) return [];

  const totalChunks = await db.bookChunk.count();
  if (totalChunks === 0) return [];

  try {
    const vectorResults = await retrieveByVector(problem);
    if (vectorResults.length > 0) return vectorResults;
  } catch (err) {
    // Embedding pipeline failed to load/run (e.g. first-load model download issue) — fall
    // through to keyword search rather than surfacing an error to the chat user.
    // eslint-disable-next-line no-console
    console.error('Vector retrieval failed, falling back to keyword search:', err);
  }

  return retrieveByKeyword(problem);
}

// Primary path: embed the problem text with the same model used at ingestion time, then
// rank BookChunk rows by pgvector cosine distance (`<=>`, ascending = closest). Only
// considers rows that actually have an embedding.
async function retrieveByVector(problem: string): Promise<RetrievedChunk[]> {
  const embedding = await embedText(problem, 'query');
  const vectorLiteral = toVectorLiteral(embedding);

  const rows = await db.$queryRaw<VectorChunkRow[]>(Prisma.sql`
    SELECT id, source, content, (embedding <=> ${Prisma.raw(`'${vectorLiteral}'::vector`)}) AS distance
    FROM "BookChunk"
    WHERE embedding IS NOT NULL
    ORDER BY distance ASC
    LIMIT ${MAX_CHUNKS}
  `);

  return rows.map((r) => ({ id: r.id, source: r.source, content: r.content }));
}

// Fallback path: sum of per-keyword ILIKE matches, each a safely parameterized pattern
// (never string concatenation) — a naive but effective relevance score with no embedding.
async function retrieveByKeyword(problem: string): Promise<RetrievedChunk[]> {
  const keywords = extractKeywords(problem);
  if (keywords.length === 0) return [];

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
