// Standalone ingestion script — reads a plain .txt file, splits it into paragraph-based
// chunks, and inserts them as BookChunk rows for keyword retrieval (see
// src/modules/chat/bookRetrieval.ts). Not wired into the Fastify app; run directly:
//
//   npx ts-node scripts/ingest-book.ts <path-to-text-file> "<source label>"
//
// e.g.  npx ts-node scripts/ingest-book.ts ./books/lal-kitab.txt "Lal Kitab (2024 edition)"
//
// PDF input is not supported here — convert PDF -> txt first (e.g. with `pdftotext`, or a
// library like pdf-parse if we decide to add that dependency later).

import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/shared/db/client';

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

  console.log(`Ingesting ${chunks.length} chunk(s) from "${resolvedPath}" as source "${sourceLabel}"...`);

  await db.bookChunk.createMany({
    data: chunks.map((content) => ({ source: sourceLabel, content })),
  });

  console.log(`Done. Inserted ${chunks.length} BookChunk row(s).`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error('Ingestion failed:', err);
  await db.$disconnect();
  process.exit(1);
});
