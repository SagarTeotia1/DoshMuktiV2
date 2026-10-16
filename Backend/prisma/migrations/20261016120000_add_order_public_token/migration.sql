-- Unguessable per-order slug for public URLs (track / invoice / resume).
ALTER TABLE "Order" ADD COLUMN "publicToken" TEXT;

-- Backfill existing orders (one distinct uuid per row).
UPDATE "Order" SET "publicToken" = left(replace(gen_random_uuid()::text, '-', ''), 16);

ALTER TABLE "Order" ALTER COLUMN "publicToken" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "publicToken" SET DEFAULT left(replace(gen_random_uuid()::text, '-', ''), 16);

CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");
