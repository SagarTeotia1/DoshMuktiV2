import type { FastifyInstance } from 'fastify';
import { verifyCustomer } from '../../shared/middleware/auth.middleware';
import { checkoutHandler, returnUrlHandler, verifyPaymentHandler } from './controller';

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

  // Public — the customer's browser is redirected here by SmartGateway, not an
  // authenticated call from our frontend. Rate limited per-IP since each hit triggers a
  // real server-to-server Order Status call.
  app.get('/checkout/return', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: returnUrlHandler,
  });
}
