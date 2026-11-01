import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { getCodFeeHandler, updateCodFeeHandler } from './controller';

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/admin/settings/cod-fee', { preHandler: verifyAdmin }, getCodFeeHandler);
  app.put('/admin/settings/cod-fee', { preHandler: verifyAdmin }, updateCodFeeHandler);
}
