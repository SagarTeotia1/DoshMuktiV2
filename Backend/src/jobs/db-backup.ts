import { env } from '../config/env';
import { logger } from '../shared/logger/pino';
import { resend } from '../shared/integrations/resend/client';
import { decryptBackup, encryptBackup, parseBackupKey } from '../shared/backup/format';
import { backupObjectKey, selectBackupsToDelete } from '../shared/backup/plan';
import { collectSnapshot } from '../shared/backup/snapshot';
import { deleteBackups, listBackups, putBackup } from '../shared/backup/storage';

export interface BackupResult {
  key: string;
  bytes: number;
  tables: number;
  rows: number;
  deleted: number;
}

const MIN_KEEP = 7;

// Nightly logical backup: consistent snapshot -> gzip -> AES-256-GCM -> private R2 bucket, then
// prune old ones. Order matters: nothing is deleted until the new backup is uploaded AND verified
// (size check on upload + a full decrypt of the exact bytes sent), and the newest MIN_KEEP are
// never pruned. On any failure the admin is emailed and the error is rethrown so the scheduler
// shows the run as failed - a silently broken backup job is the real risk.
export async function runDbBackup(): Promise<BackupResult> {
  try {
    const key = parseBackupKey(env.BACKUP_ENCRYPTION_KEY);
    const snapshot = await collectSnapshot();
    const rows = Object.values(snapshot.manifest.tables).reduce((a, b) => a + b, 0);
    // An empty database is never a legitimate backup (it would also start pruning good ones).
    if (rows === 0) throw new Error('Snapshot has 0 rows - refusing to store or prune anything');

    const file = encryptBackup(snapshot, key);
    const roundTrip = decryptBackup(file, key);
    if (JSON.stringify(roundTrip.manifest.tables) !== JSON.stringify(snapshot.manifest.tables)) {
      throw new Error('Backup failed its own round-trip check');
    }

    const objectKey = backupObjectKey(new Date());
    await putBackup(objectKey, file);

    const stale = selectBackupsToDelete(await listBackups(), new Date(), env.BACKUP_RETENTION_DAYS, MIN_KEEP);
    await deleteBackups(stale.map((b) => b.key));

    const result = { key: objectKey, bytes: file.length, tables: Object.keys(snapshot.manifest.tables).length, rows, deleted: stale.length };
    logger.info(result, 'Database backup complete');
    return result;
  } catch (err) {
    logger.error({ err }, 'Database backup FAILED');
    if (resend) {
      await resend.emails
        .send({
          from: env.RESEND_FROM_EMAIL,
          to: env.ADMIN_EMAIL,
          subject: 'ALERT: nightly database backup failed',
          html: `<p>The nightly database backup failed at ${new Date().toISOString()}.</p><pre>${String(err instanceof Error ? err.message : err).replace(/</g, '&lt;')}</pre><p>Check the Backend logs. Until it is fixed, the most recent earlier backup is your newest recovery point.</p>`,
        })
        .catch(() => undefined);
    }
    throw err;
  }
}
