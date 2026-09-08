import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { pendingPickupCountHandler, listPickupRequestsHandler, createPickupRequestHandler } from './controller';

export async function pickupRequestsRoutes(app: FastifyInstance) {
  app.get('/admin/pickup-requests/pending-count', { preHandler: verifyAdmin }, pendingPickupCountHandler);
  app.get('/admin/pickup-requests', { preHandler: verifyAdmin }, listPickupRequestsHandler);
  app.post('/admin/pickup-requests', { preHandler: verifyAdmin }, createPickupRequestHandler);
}
