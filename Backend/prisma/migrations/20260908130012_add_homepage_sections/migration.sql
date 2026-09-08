-- CreateTable
CREATE TABLE "HomepageSection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomepageSectionItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomepageSectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageSection_key_key" ON "HomepageSection"("key");

-- CreateIndex
CREATE INDEX "HomepageSectionItem_sectionId_order_idx" ON "HomepageSectionItem"("sectionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "HomepageSectionItem_sectionId_productId_key" ON "HomepageSectionItem"("sectionId", "productId");

-- AddForeignKey
ALTER TABLE "HomepageSectionItem" ADD CONSTRAINT "HomepageSectionItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSectionItem" ADD CONSTRAINT "HomepageSectionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
