-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "showInSuggestions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN "showInSuggestions" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Offer_showInSuggestions_idx" ON "Offer"("showInSuggestions");

-- CreateIndex
CREATE INDEX "Coupon_showInSuggestions_idx" ON "Coupon"("showInSuggestions");
