-- Restructure Offer: split the old single `type` field into independent `behavior`
-- (WHEN the reward activates) and `reward` (WHAT the customer gets), with reward-specific
-- data moved into a `config` JSON payload instead of dedicated columns per type.
-- Existing rows are backfilled before the old columns are dropped — no data loss.

-- CreateEnum
CREATE TYPE "OfferBehavior" AS ENUM ('DISPLAY_ONLY', 'AUTO_APPLIED', 'COUPON_BASED');

-- CreateEnum
CREATE TYPE "OfferReward" AS ENUM ('DISPLAY_MESSAGE', 'PERCENTAGE_DISCOUNT', 'FLAT_DISCOUNT', 'CASHBACK', 'FREE_GIFT', 'BUY_X_GET_Y', 'FREE_SHIPPING');

-- AlterTable: add new columns alongside the old ones so we can backfill before dropping
ALTER TABLE "Offer"
  ADD COLUMN "behavior" "OfferBehavior" NOT NULL DEFAULT 'DISPLAY_ONLY',
  ADD COLUMN "reward" "OfferReward" NOT NULL DEFAULT 'DISPLAY_MESSAGE',
  ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "couponId" TEXT;

-- Backfill: DISPLAY -> DISPLAY_ONLY / DISPLAY_MESSAGE
UPDATE "Offer"
SET "behavior" = 'DISPLAY_ONLY',
    "reward" = 'DISPLAY_MESSAGE',
    "config" = jsonb_build_object('bannerText', "title")
WHERE "type" = 'DISPLAY';

-- Backfill: FREE_ITEM -> AUTO_APPLIED / FREE_GIFT
UPDATE "Offer"
SET "behavior" = 'AUTO_APPLIED',
    "reward" = 'FREE_GIFT',
    "config" = jsonb_build_object('productId', "freeProductId")
WHERE "type" = 'FREE_ITEM';

-- Backfill: CASHBACK -> AUTO_APPLIED / CASHBACK
UPDATE "Offer"
SET "behavior" = 'AUTO_APPLIED',
    "reward" = 'CASHBACK',
    "config" = jsonb_build_object('percent', "cashbackPercent")
WHERE "type" = 'CASHBACK';

-- Backfill: DISCOUNT (PERCENT) -> AUTO_APPLIED / PERCENTAGE_DISCOUNT
UPDATE "Offer"
SET "behavior" = 'AUTO_APPLIED',
    "reward" = 'PERCENTAGE_DISCOUNT',
    "config" = jsonb_build_object('percent', "discountValue", 'maxDiscount', "maxDiscount")
WHERE "type" = 'DISCOUNT' AND "discountType" = 'PERCENT';

-- Backfill: DISCOUNT (FLAT) -> AUTO_APPLIED / FLAT_DISCOUNT
UPDATE "Offer"
SET "behavior" = 'AUTO_APPLIED',
    "reward" = 'FLAT_DISCOUNT',
    "config" = jsonb_build_object('amount', "discountValue")
WHERE "type" = 'DISCOUNT' AND "discountType" = 'FLAT';

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_freeProductId_fkey";

-- DropIndex
DROP INDEX "Offer_type_idx";

-- AlterTable: drop the old type-specific columns now that everything is backfilled
ALTER TABLE "Offer"
  DROP COLUMN "type",
  DROP COLUMN "cashbackPercent",
  DROP COLUMN "discountType",
  DROP COLUMN "discountValue",
  DROP COLUMN "maxDiscount",
  DROP COLUMN "freeProductId";

-- DropEnum
DROP TYPE "OfferType";

-- DropEnum
DROP TYPE "OfferDiscountType";

-- CreateIndex
CREATE INDEX "Offer_behavior_idx" ON "Offer"("behavior");

-- CreateIndex
CREATE INDEX "Offer_reward_idx" ON "Offer"("reward");

-- CreateIndex
CREATE INDEX "Offer_couponId_idx" ON "Offer"("couponId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
