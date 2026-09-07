import sharp from 'sharp';
import { nanoid } from 'nanoid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../../shared/integrations/r2/client';
import { env } from '../../config/env';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export class InvalidFileError extends Error {}

export type UploadKind = 'product' | 'banner';

// Banners are the single largest, most visually prominent image on the site — shown
// full-bleed up to ~2560px wide on large desktop monitors. Capping them at the same
// 1200px/q82 profile used for product thumbnails meant every banner got upscaled by
// the browser to fill its slot, which is what actually reads as "compressed" — the
// pixels genuinely aren't there. Product images stay small on purpose (card/PDP
// gallery never render anywhere near 2400px), so they keep the tighter profile.
const RESIZE_PROFILES: Record<UploadKind, { thumb: number; card: number; full: number; quality: number }> = {
  product: { thumb: 150, card: 600, full: 1200, quality: 82 },
  banner: { thumb: 300, card: 1600, full: 2560, quality: 90 },
};

export async function uploadProductImage(
  buffer: Buffer,
  mimeType: string,
  kind: UploadKind = 'product'
): Promise<{ thumb: string; card: string; full: string }> {
  if (!ALLOWED_MIME.includes(mimeType)) throw new InvalidFileError('Invalid file type');
  if (buffer.length > MAX_SIZE_BYTES) throw new InvalidFileError('File too large');

  const profile = RESIZE_PROFILES[kind];
  const id = nanoid();
  const [thumb, card, full] = await Promise.all([
    sharp(buffer).resize(profile.thumb, profile.thumb, { fit: 'cover' }).webp({ quality: profile.quality }).toBuffer(),
    sharp(buffer).resize(profile.card, profile.card, { fit: 'cover' }).webp({ quality: profile.quality }).toBuffer(),
    // withoutEnlargement: a source smaller than the target keeps its native
    // resolution instead of sharp fabricating extra pixels by upscaling — that
    // would look exactly as soft as the bug this is fixing.
    sharp(buffer)
      .resize(profile.full, profile.full, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: profile.quality })
      .toBuffer(),
  ]);

  const prefix = `${kind === 'banner' ? 'banners' : 'products'}/${id}`;
  // Keys are nanoid-based and never overwritten, so these are safe to cache forever —
  // a new upload always gets a new key rather than mutating an existing one.
  const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
  await Promise.all([
    r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: `${prefix}/thumb.webp`, Body: thumb, ContentType: 'image/webp', CacheControl: IMMUTABLE_CACHE })),
    r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: `${prefix}/card.webp`, Body: card, ContentType: 'image/webp', CacheControl: IMMUTABLE_CACHE })),
    r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: `${prefix}/full.webp`, Body: full, ContentType: 'image/webp', CacheControl: IMMUTABLE_CACHE })),
  ]);

  return {
    thumb: `${env.R2_PUBLIC_URL}/${prefix}/thumb.webp`,
    card: `${env.R2_PUBLIC_URL}/${prefix}/card.webp`,
    full: `${env.R2_PUBLIC_URL}/${prefix}/full.webp`,
  };
}
