-- CreateTable
CREATE TABLE "BookChunk" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookChunk_source_idx" ON "BookChunk"("source");
