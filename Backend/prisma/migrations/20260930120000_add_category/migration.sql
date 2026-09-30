-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripLabel" TEXT,
    "image" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_isActive_order_idx" ON "Category"("isActive", "order");

-- Backfill: every category name already used by a product or a CATEGORY-scoped offer
-- becomes a row, names untouched. The six homepage-strip categories keep their old order.
INSERT INTO "Category" ("id", "name", "order", "updatedAt")
SELECT
    'cat_' || md5(n.name),
    n.name,
    CASE n.name
        WHEN 'Rudraksha / Kada' THEN 0
        WHEN 'Bracelets' THEN 1
        WHEN 'DoshMukti Special' THEN 2
        WHEN 'Pyrite Items' THEN 3
        WHEN 'Attar' THEN 4
        WHEN 'Dhoop Sticks' THEN 5
        ELSE 100
    END,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT unnest("categories") AS name FROM "Product"
    UNION
    SELECT DISTINCT "category" FROM "Offer" WHERE "category" IS NOT NULL
) n
WHERE n.name <> '';

-- Two new categories (hidden on the storefront until they have an active product).
-- ON CONFLICT so re-running against a DB that already has them is a no-op.
INSERT INTO "Category" ("id", "name", "stripLabel", "order", "updatedAt") VALUES
    ('cat_' || md5('Spiritual Car Perfume'), 'Spiritual Car Perfume', 'Car Perfume', 6, CURRENT_TIMESTAMP),
    ('cat_' || md5('Mulank Bracelet'), 'Mulank Bracelet', 'Mulank', 7, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
