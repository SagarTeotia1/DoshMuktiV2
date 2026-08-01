import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { trackOrderHandler, listOrdersHandler, getOrderByIdHandler, updateOrderStatusHandler } from './controller';

export async function orderRoutes(app: FastifyInstance) {
  app.get('/orders/:orderNumber', trackOrderHandler); // public — track by orderNumber
  app.get('/admin/orders', { preHandler: verifyAdmin }, listOrdersHandler);
  app.get('/admin/orders/:id', { preHandler: verifyAdmin }, getOrderByIdHandler);
  app.patch('/admin/orders/:id/status', { preHandler: verifyAdmin }, updateOrderStatusHandler);
}
