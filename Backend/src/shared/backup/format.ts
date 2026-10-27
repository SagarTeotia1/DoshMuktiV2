import crypto from 'node:crypto';
import zlib from 'node:zlib';

// Backup file = MAGIC | iv(12) | authTag(16) | AES-256-GCM(gzip(JSON)). The GCM tag authenticates
// the whole file, so a truncated, corrupted or tampered backup fails to open instead of
// restoring garbage. MAGIC is bound in as additional authenticated data.
export const BACKUP_MAGIC = Buffer.from('DMBK1');
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface BackupManifest {
  version: 1;
  createdAt: string; // ISO
  serverVersion: string;
  /** Applied Prisma migrations at dump time - a restore target must be migrated at least this far. */
  migrations: string[];
  /** Row count per table. */
  tables: Record<string, number>;
}

export interface BackupPayload {
  manifest: BackupManifest;
  /** Table name -> rows, each row exactly as Postgres' to_jsonb() produced it. */
  data: Record<string, unknown[]>;
}

export class BackupFormatError extends Error {}

// A 32-byte key written as 64 hex chars (openssl rand -hex 32) or as base64
// (openssl rand -base64 32 -> 44 chars ending in "="). Both decode to the same kind of key.
export const BACKUP_KEY_PATTERN = /^([0-9a-fA-F]{64}|[A-Za-z0-9+/]{43}=)$/;

export function parseBackupKey(value: string): Buffer {
  const v = value.trim();
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, 'hex');
  if (/^[A-Za-z0-9+/]{43}=$/.test(v)) {
    const bytes = Buffer.from(v, 'base64');
    if (bytes.length === 32) return bytes;
  }
  throw new BackupFormatError('BACKUP_ENCRYPTION_KEY must be 32 bytes: 64 hex chars (openssl rand -hex 32) or base64 (openssl rand -base64 32)');
}

export function encryptBackup(payload: BackupPayload, key: Buffer): Buffer {
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload)));
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(BACKUP_MAGIC);
  const ct = Buffer.concat([cipher.update(gz), cipher.final()]);
  return Buffer.concat([BACKUP_MAGIC, iv, cipher.getAuthTag(), ct]);
}

export function decryptBackup(file: Buffer, key: Buffer): BackupPayload {
  const headerLen = BACKUP_MAGIC.length + IV_BYTES + TAG_BYTES;
  if (file.length <= headerLen || !file.subarray(0, BACKUP_MAGIC.length).equals(BACKUP_MAGIC)) {
    throw new BackupFormatError('Not a Doshmukti backup file (bad header)');
  }
  const iv = file.subarray(BACKUP_MAGIC.length, BACKUP_MAGIC.length + IV_BYTES);
  const tag = file.subarray(BACKUP_MAGIC.length + IV_BYTES, headerLen);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(BACKUP_MAGIC);
  decipher.setAuthTag(tag);
  let gz: Buffer;
  try {
    gz = Buffer.concat([decipher.update(file.subarray(headerLen)), decipher.final()]);
  } catch {
    throw new BackupFormatError('Backup could not be decrypted: wrong BACKUP_ENCRYPTION_KEY, or the file is corrupted/tampered');
  }
  const payload = JSON.parse(zlib.gunzipSync(gz).toString('utf8')) as BackupPayload;
  if (payload?.manifest?.version !== 1 || typeof payload.data !== 'object') {
    throw new BackupFormatError('Unsupported backup payload version');
  }
  return payload;
}
