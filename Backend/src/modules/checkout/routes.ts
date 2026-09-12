import type { FastifyInstance } from 'fastify';
import { verifyCustomer } from '../../shared/middleware/auth.middleware';
import { checkoutHandler, returnUrlHandler } from './controller';

export async function checkoutRoutes(app: FastifyInstance) {
  app.post('/checkout', {
    preHandler: verifyCustomer,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: checkoutHandler,
  });

  // Public — hit by the customer's browser being redirected here by SmartGateway, not
  // an authenticated call from our own frontend. See returnUrlHandler's comment. Rate
  // limited per-IP since each hit triggers a real server-to-server Order Status call —
  // an open, unauthenticated endpoint that fans out to an external API on every request
  // needs a cap regardless of how unlikely abuse is in practice.
  app.get('/checkout/return', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: returnUrlHandler,
  });
}
