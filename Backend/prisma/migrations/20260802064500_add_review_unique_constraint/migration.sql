-- Drop the plain indexes created in the previous migration that are superseded by the unique index below
DROP INDEX IF EXISTS "Review_productId_status_idx";
DROP INDEX IF EXISTS "Review_status_createdAt_idx";
DROP INDEX IF EXISTS "Review_orderId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_productId_key" ON "Review"("orderId", "productId");

-- CreateIndex
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");
