import sharp from 'sharp';
import { nanoid } from 'nanoid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../../shared/integrations/r2/client';
import { env } from '../../config/env';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export class InvalidFileError extends Error {}

export async function uploadProductImage(buffer: Buffer, mimeType: string): Promise<{ thumb: string; card: string; full: string }> {
  if (!ALLOWED_MIME.includes(mimeType)) throw new InvalidFileError('Invalid file type');
  if (buffer.length > MAX_SIZE_BYTES) throw new InvalidFileError('File too large');

  const id = nanoid();
  const [thumb, card, full] = await Promise.all([
    sharp(buffer).resize(150, 150, { fit: 'cover' }).webp({ quality: 82 }).toBuffer(),
    sharp(buffer).resize(600, 600, { fit: 'cover' }).webp({ quality: 82 }).toBuffer(),
    sharp(buffer).resize(1200, 1200, { fit: 'inside' }).webp({ quality: 82 }).toBuffer(),
  ]);

  const prefix = `products/${id}`;
  await Promise.all([
    r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: `${prefix}/thumb.webp`, Body: thumb, ContentType: 'image/webp' })),
    r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: `${prefix}/card.webp`, Body: card, ContentType: 'image/webp' })),
    r2.send(new PutObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: `${prefix}/full.webp`, Body: full, ContentType: 'image/webp' })),
  ]);

  return {
    thumb: `${env.R2_PUBLIC_URL}/${prefix}/thumb.webp`,
    card: `${env.R2_PUBLIC_URL}/${prefix}/card.webp`,
    full: `${env.R2_PUBLIC_URL}/${prefix}/full.webp`,
  };
}
