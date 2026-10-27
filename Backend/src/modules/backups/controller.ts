import type { FastifyReply, FastifyRequest } from 'fastify';
import { BackupBusyError, getBackupOverview, missingBackupSettings, runBackupNow } from './service';

export async function listBackupsHandler(req: FastifyRequest, reply: FastifyReply) {
  try {
    return reply.send(await getBackupOverview());
  } catch (err) {
    req.log.error({ err }, 'Listing backups failed');
    return reply.code(502).send({ error: err instanceof Error ? err.message : 'Could not list backups' });
  }
}

// Admin "Back up now". Same job as the nightly cron (it emails the admin on failure too).
export async function runBackupHandler(req: FastifyRequest, reply: FastifyReply) {
  if (missingBackupSettings().length > 0) {
    return reply.code(503).send({ error: `Backups are not set up on the server (missing ${missingBackupSettings().join(', ')})` });
  }
  try {
    return reply.send(await runBackupNow());
  } catch (err) {
    if (err instanceof BackupBusyError) return reply.code(409).send({ error: err.message });
    req.log.error({ err }, 'Manual backup failed');
    return reply.code(502).send({ error: err instanceof Error ? err.message : 'Backup failed' });
  }
}
