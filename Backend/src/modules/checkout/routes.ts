import type { FastifyInstance } from 'fastify';
import { verifyCustomer } from '../../shared/middleware/auth.middleware';
import { checkoutHandler, verifyPaymentHandler } from './controller';

export async function checkoutRoutes(app: FastifyInstance) {
  app.post('/checkout', {
    preHandler: verifyCustomer,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: checkoutHandler,
  });

  app.post('/checkout/verify', {
    preHandler: verifyCustomer,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: verifyPaymentHandler,
  });
}
