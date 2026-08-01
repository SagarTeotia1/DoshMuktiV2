import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { getDashboardHandler, getSalesTrendHandler } from './controller';

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/admin/dashboard', { preHandler: verifyAdmin }, getDashboardHandler);
  app.get('/admin/dashboard/sales', { preHandler: verifyAdmin }, getSalesTrendHandler);
}
