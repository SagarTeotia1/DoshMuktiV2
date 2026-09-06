-- Product.category (single string) becomes Product.categories (string[]) — a product
-- can now be shared across multiple categories instead of exactly one. Existing values
-- are preserved as a single-element array so nothing currently browsable disappears.

ALTER TABLE "Product" ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "Product" SET "categories" = ARRAY["category"];

DROP INDEX "Product_status_category_idx";

ALTER TABLE "Product" DROP COLUMN "category";

CREATE INDEX "Product_status_idx" ON "Product"("status");
