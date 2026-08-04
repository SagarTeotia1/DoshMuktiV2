-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "descriptionImages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "exclusiveOffers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "howToUseVideoUrl" TEXT,
ADD COLUMN     "selfEnergizeInstructions" TEXT,
ADD COLUMN     "sidhiPrice" INTEGER;
