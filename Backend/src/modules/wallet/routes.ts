import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { getBalanceHandler, adminAdjustHandler } from './controller';

export async function walletRoutes(app: FastifyInstance) {
  app.get('/wallet/balance', getBalanceHandler);
  app.post('/admin/wallet/adjust', { preHandler: verifyAdmin }, adminAdjustHandler);
}
