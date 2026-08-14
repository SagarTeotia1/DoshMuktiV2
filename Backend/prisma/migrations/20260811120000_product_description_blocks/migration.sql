-- Replace flat `description` text with an ordered block array
-- (DescriptionBlock[] = {type:'text',content} | {type:'image',thumb,card,full}),
-- and fold the old `descriptionImages` gallery into the tail of that array so no
-- admin-uploaded content is lost. Backfill happens BEFORE the old columns are
-- dropped — no data loss for existing products.

-- 1. Add the new column alongside the old ones.
ALTER TABLE "Product" ADD COLUMN "descriptionBlocks" JSONB;

-- 2. Backfill: old plain-text description (if any) becomes a single text block,
--    followed by each existing descriptionImages entry as an image block, in order.
UPDATE "Product"
SET "descriptionBlocks" =
  (
    CASE
      WHEN "description" IS NOT NULL AND length(trim("description")) > 0
        THEN jsonb_build_array(jsonb_build_object('type', 'text', 'content', "description"))
      ELSE '[]'::jsonb
    END
  )
  ||
  (
    CASE
      WHEN jsonb_typeof("descriptionImages") = 'array'
        THEN COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'type', 'image',
                'thumb', img->>'thumb',
                'card', img->>'card',
                'full', img->>'full'
              )
            )
            FROM jsonb_array_elements("descriptionImages") AS img
          ),
          '[]'::jsonb
        )
      ELSE '[]'::jsonb
    END
  );

-- 3. Drop the old columns now that everything has been carried forward.
ALTER TABLE "Product" DROP COLUMN "description";
ALTER TABLE "Product" DROP COLUMN "descriptionImages";

-- 4. Promote the new column to be `description`, matching prisma schema.
ALTER TABLE "Product" RENAME COLUMN "descriptionBlocks" TO "description";
ALTER TABLE "Product" ALTER COLUMN "description" SET DEFAULT '[]';
ALTER TABLE "Product" ALTER COLUMN "description" SET NOT NULL;
