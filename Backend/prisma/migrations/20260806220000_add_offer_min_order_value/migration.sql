-- Optional spend-threshold condition on an Offer, independent of reward/behavior. Purely
-- additive/nullable — every existing offer defaults to no condition (unchanged behavior).

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "minOrderValue" DECIMAL(10,2);
