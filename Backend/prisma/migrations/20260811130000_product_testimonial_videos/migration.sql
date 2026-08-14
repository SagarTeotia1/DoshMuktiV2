-- Add testimonialVideos JSONB column for the "Loved by X customers" PDP video row.
-- TestimonialVideo[] = [{id, videoUrl, posterUrl, caption, views}], admin-managed.
ALTER TABLE "Product" ADD COLUMN "testimonialVideos" JSONB NOT NULL DEFAULT '[]';
