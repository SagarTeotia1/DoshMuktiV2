import type { FastifyInstance } from 'fastify';
import { verifyCustomer } from '../../shared/middleware/auth.middleware';
import { checkoutHandler } from './controller';

export async function checkoutRoutes(app: FastifyInstance) {
  app.post('/checkout', {
    preHandler: verifyCustomer,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: checkoutHandler,
  });
}
