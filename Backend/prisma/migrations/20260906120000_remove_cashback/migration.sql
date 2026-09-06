-- Remove the cashback feature: Product.cashbackPercent and the Offer CASHBACK reward
-- type. WalletTransactionReason.CASHBACK_EARNED is intentionally left in place — it's
-- only a label on historical ledger rows, and dropping it would orphan them. No new
-- CASHBACK_EARNED rows are written anymore (see wallet/service.ts).

-- Offers using the CASHBACK reward have no meaning once the feature is gone.
DELETE FROM "Offer" WHERE "reward" = 'CASHBACK';

-- Postgres has no ALTER TYPE ... DROP VALUE — recreate the enum without CASHBACK.
ALTER TYPE "OfferReward" RENAME TO "OfferReward_old";
CREATE TYPE "OfferReward" AS ENUM ('DISPLAY_MESSAGE', 'PERCENTAGE_DISCOUNT', 'FLAT_DISCOUNT', 'FREE_GIFT', 'BUY_X_GET_Y', 'FREE_SHIPPING');
ALTER TABLE "Offer" ALTER COLUMN "reward" DROP DEFAULT;
ALTER TABLE "Offer" ALTER COLUMN "reward" TYPE "OfferReward" USING ("reward"::text::"OfferReward");
ALTER TABLE "Offer" ALTER COLUMN "reward" SET DEFAULT 'DISPLAY_MESSAGE';
DROP TYPE "OfferReward_old";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "cashbackPercent";
