import { env } from '../../config/env';
import { BackupBusyError, runDbBackup, type BackupResult } from '../../jobs/db-backup';
import { listBackups } from '../../shared/backup/storage';

export { BackupBusyError };

export interface BackupSummary {
  key: string;
  takenAt: string; // ISO
  sizeBytes: number;
}

export interface BackupOverview {
  configured: boolean;
  /** Env settings still missing when not configured (names only). */
  missing: string[];
  retentionDays: number;
  backups: BackupSummary[];
}

export function missingBackupSettings(): string[] {
  const missing: string[] = [];
  if (!env.BACKUP_R2_BUCKET) missing.push('BACKUP_R2_BUCKET');
  if (!env.BACKUP_ENCRYPTION_KEY) missing.push('BACKUP_ENCRYPTION_KEY');
  return missing;
}

// What the Admin Backups page shows: whether backups are set up and the files already in the bucket
// (newest first). Never exposes file contents or the key - listing only.
export async function getBackupOverview(): Promise<BackupOverview> {
  const missing = missingBackupSettings();
  if (missing.length > 0) return { configured: false, missing, retentionDays: env.BACKUP_RETENTION_DAYS, backups: [] };
  const files = await listBackups();
  return {
    configured: true,
    missing: [],
    retentionDays: env.BACKUP_RETENTION_DAYS,
    backups: files
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
      .map((f) => ({ key: f.key, takenAt: f.lastModified.toISOString(), sizeBytes: f.size })),
  };
}

export async function runBackupNow(): Promise<BackupResult> {
  const missing = missingBackupSettings();
  if (missing.length > 0) throw new Error(`Backups are not set up on the server (missing ${missing.join(', ')})`);
  return runDbBackup();
}
