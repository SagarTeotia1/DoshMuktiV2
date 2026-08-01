-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "benefits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "careInstructions" TEXT,
ADD COLUMN     "howToWear" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "socialProofText" TEXT;
