-- Enable pgvector extension (Prisma's Unsupported() type can't generate this itself).
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "BookChunk" ADD COLUMN     "embedding" vector(384);
