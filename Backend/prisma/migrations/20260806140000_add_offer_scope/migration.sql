-- Add offer targeting scope: an offer can apply to specific products (existing M:N
-- relation, unchanged behavior), an entire product category, or store-wide. Purely
-- additive — every existing Offer row defaults to SPECIFIC_PRODUCTS, preserving its
-- current product assignments and behavior exactly.

-- CreateEnum
CREATE TYPE "OfferScope" AS ENUM ('SPECIFIC_PRODUCTS', 'CATEGORY', 'ALL_PRODUCTS');

-- AlterTable
ALTER TABLE "Offer"
  ADD COLUMN "scope" "OfferScope" NOT NULL DEFAULT 'SPECIFIC_PRODUCTS',
  ADD COLUMN "category" TEXT;

-- CreateIndex
CREATE INDEX "Offer_scope_category_idx" ON "Offer"("scope", "category");
