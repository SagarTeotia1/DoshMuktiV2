import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../config/env';
import { r2 } from '../integrations/r2/client';
import type { StoredBackup } from './plan';

// Backups live in their OWN private bucket. The main R2 bucket (R2_BUCKET_NAME) serves product
// images publicly - a database dump (phones, addresses, orders) must never go there.
export function backupBucket(): string {
  const bucket = env.BACKUP_R2_BUCKET;
  if (!bucket) throw new Error('BACKUP_R2_BUCKET is not set - database backups are disabled');
  if (bucket === env.R2_BUCKET_NAME) {
    throw new Error('BACKUP_R2_BUCKET must be a different, private bucket - R2_BUCKET_NAME serves public images');
  }
  return bucket;
}

export async function putBackup(key: string, body: Buffer): Promise<void> {
  const Bucket = backupBucket();
  await r2.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: 'application/octet-stream' }));
  const head = await r2.send(new HeadObjectCommand({ Bucket, Key: key }));
  if (head.ContentLength !== body.length) {
    throw new Error(`Uploaded backup size mismatch for ${key}: sent ${body.length}, stored ${head.ContentLength}`);
  }
}

export async function listBackups(): Promise<StoredBackup[]> {
  const Bucket = backupBucket();
  const out: StoredBackup[] = [];
  let token: string | undefined;
  do {
    const page = await r2.send(new ListObjectsV2Command({ Bucket, Prefix: 'db/', ContinuationToken: token }));
    for (const o of page.Contents ?? []) {
      if (o.Key && o.LastModified && o.Key.endsWith('.dmbk')) out.push({ key: o.Key, lastModified: o.LastModified, size: o.Size ?? 0 });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function getBackup(key: string): Promise<Buffer> {
  const res = await r2.send(new GetObjectCommand({ Bucket: backupBucket(), Key: key }));
  if (!res.Body) throw new Error(`Backup ${key} is empty`);
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function deleteBackups(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await r2.send(new DeleteObjectsCommand({ Bucket: backupBucket(), Delete: { Objects: keys.map((Key) => ({ Key })) } }));
}
