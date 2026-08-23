-- Drop the verified-purchase unique constraint (orderId is going away)
DROP INDEX IF EXISTS "Review_orderId_productId_key";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "orderId",
DROP COLUMN "customerPhone";
