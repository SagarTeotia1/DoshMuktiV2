import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { listInventoryHandler, adjustStockHandler, importStockHandler, exportInventoryHandler } from './controller';

export async function inventoryRoutes(app: FastifyInstance) {
  app.get('/admin/inventory', { preHandler: verifyAdmin }, listInventoryHandler);
  app.get('/admin/inventory/export', { preHandler: verifyAdmin }, exportInventoryHandler);
  app.post('/admin/inventory/adjust', { preHandler: verifyAdmin }, adjustStockHandler);
  app.post('/admin/inventory/import', { preHandler: verifyAdmin }, importStockHandler);
}
