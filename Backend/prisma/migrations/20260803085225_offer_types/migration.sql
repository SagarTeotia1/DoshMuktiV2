-- CreateEnum
CREATE TYPE "OfferType" AS ENUM ('DISPLAY', 'FREE_ITEM', 'CASHBACK', 'DISCOUNT');

-- CreateEnum
CREATE TYPE "OfferDiscountType" AS ENUM ('FLAT', 'PERCENT');

-- DropForeignKey
ALTER TABLE "_OfferToProduct" DROP CONSTRAINT "_OfferToProduct_A_fkey";

-- DropForeignKey
ALTER TABLE "_OfferToProduct" DROP CONSTRAINT "_OfferToProduct_B_fkey";

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "cashbackPercent" INTEGER,
ADD COLUMN     "discountType" "OfferDiscountType",
ADD COLUMN     "discountValue" DECIMAL(10,2),
ADD COLUMN     "freeProductId" TEXT,
ADD COLUMN     "maxDiscount" DECIMAL(10,2),
ADD COLUMN     "type" "OfferType" NOT NULL DEFAULT 'DISPLAY';

-- DropTable
DROP TABLE "_OfferToProduct";

-- CreateTable
CREATE TABLE "_OfferProducts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_OfferProducts_AB_unique" ON "_OfferProducts"("A", "B");

-- CreateIndex
CREATE INDEX "_OfferProducts_B_index" ON "_OfferProducts"("B");

-- CreateIndex
CREATE INDEX "Offer_type_idx" ON "Offer"("type");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_freeProductId_fkey" FOREIGN KEY ("freeProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferProducts" ADD CONSTRAINT "_OfferProducts_A_fkey" FOREIGN KEY ("A") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferProducts" ADD CONSTRAINT "_OfferProducts_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

