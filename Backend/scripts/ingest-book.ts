// Standalone ingestion script — reads a plain .txt file, splits it into paragraph-based
// chunks, embeds each chunk (Transformers.js, local + free, see
// src/shared/ai/embeddings.ts), and inserts them as BookChunk rows for retrieval (see
// src/modules/chat/bookRetrieval.ts). Not wired into the Fastify app; run directly:
//
//   npx ts-node scripts/ingest-book.ts <path-to-text-file> "<source label>"
//
// e.g.  npx ts-node scripts/ingest-book.ts ./scripts/tmp/book-ocr.txt "Dosh Mukti (OCR)"
//
// PDF input is not supported here — for the scanned/image-based Hindi PDF this repo
// ingests, see scripts/ocr-book.py (one-time throwaway Python OCR step) which produces the
// plain .txt this script consumes.

import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { db } from '../src/shared/db/client';
import { embedText, toVectorLiteral } from '../src/shared/ai/embeddings';

const MIN_CHUNK_CHARS = 400; // merge short paragraphs together until a chunk reaches this
const MAX_CHUNK_CHARS = 1000; // hard cap before starting a new chunk

function chunkText(text: string): string[] {
  // Split on blank lines (one or more) — paragraph boundaries.
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length === 0) {
      current = para;
      continue;
    }

    if (current.length + 1 + para.length <= MAX_CHUNK_CHARS) {
      current = `${current} ${para}`;
    } else if (current.length >= MIN_CHUNK_CHARS) {
      chunks.push(current);
      current = para;
    } else {
      // current is still too small but adding para would blow the cap — flush anyway
      // rather than growing unbounded, then start fresh with para.
      chunks.push(current);
      current = para;
    }
  }

  if (current.length > 0) chunks.push(current);

  return chunks;
}

async function main() {
  const [, , filePath, sourceLabel] = process.argv;

  if (!filePath || !sourceLabel) {
    console.error('Usage: npx ts-node scripts/ingest-book.ts <path-to-text-file> "<source label>"');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(resolvedPath, 'utf-8');
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    console.error('No chunkable text found in file — nothing to ingest.');
    process.exit(1);
  }

  console.log(
    `Ingesting ${chunks.length} chunk(s) from "${resolvedPath}" as source "${sourceLabel}" (embedding each via Transformers.js — first call downloads model weights, this may take a bit)...`
  );

  let inserted = 0;
  for (const content of chunks) {
    let vectorLiteral: string | null = null;
    try {
      const embedding = await embedText(content, 'passage');
      vectorLiteral = toVectorLiteral(embedding);
    } catch (err) {
      // Embedding failures shouldn't lose the chunk — insert without one; bookRetrieval's
      // keyword fallback still covers rows where embedding IS NULL.
      console.error(`  embedding failed for chunk ${inserted + 1}/${chunks.length}, inserting without embedding:`, err);
    }

    // BookChunk.embedding is `Unsupported("vector(384)")` — Prisma's generated client has no
    // read/write API for it, so this insert goes through $executeRaw. `content`/`sourceLabel`
    // are bound as real Prisma.sql parameters (never string-concatenated); the vector literal
    // is safe to splice in as Prisma.raw because it's built purely from numbers we computed
    // in embedText, never from untrusted input.
    // BookChunk.id normally comes from Prisma's @default(cuid()), which only applies through
    // the generated client's insert path. $executeRaw bypasses that, so generate the id here
    // — nanoid is already used the same way elsewhere in this backend (see upload/service.ts).
    const id = nanoid();

    if (vectorLiteral) {
      await db.$executeRaw(Prisma.sql`
        INSERT INTO "BookChunk" ("id", "source", "content", "embedding", "createdAt")
        VALUES (${id}, ${sourceLabel}, ${content}, ${Prisma.raw(`'${vectorLiteral}'::vector`)}, NOW())
      `);
    } else {
      await db.$executeRaw(Prisma.sql`
        INSERT INTO "BookChunk" ("id", "source", "content", "createdAt")
        VALUES (${id}, ${sourceLabel}, ${content}, NOW())
      `);
    }

    inserted += 1;
    if (inserted % 10 === 0 || inserted === chunks.length) {
      console.log(`  ${inserted}/${chunks.length} chunks embedded + inserted`);
    }
  }

  console.log(`Done. Inserted ${inserted} BookChunk row(s).`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error('Ingestion failed:', err);
  await db.$disconnect();
  process.exit(1);
});
