import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { warehouseHandler, rateCalcHandler, shippingEstimateHandler } from './controller';

export async function shippingRoutes(app: FastifyInstance) {
  app.get('/admin/shipping/warehouse', { preHandler: verifyAdmin }, warehouseHandler);
  app.get('/admin/shipping/rate-calc', { preHandler: verifyAdmin }, rateCalcHandler);
  app.get('/shipping/estimate', shippingEstimateHandler); // public — used on the PDP
}
