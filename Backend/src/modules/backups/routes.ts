import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { listBackupsHandler, runBackupHandler } from './controller';

export async function backupsRoutes(app: FastifyInstance) {
  app.get('/admin/backups', { preHandler: verifyAdmin }, listBackupsHandler);
  app.post('/admin/backups/run', { preHandler: verifyAdmin, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, runBackupHandler);
}
