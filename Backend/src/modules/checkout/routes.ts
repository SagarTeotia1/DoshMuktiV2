import type { FastifyInstance } from 'fastify';
import { checkoutHandler } from './controller';

export async function checkoutRoutes(app: FastifyInstance) {
  app.post('/checkout', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: checkoutHandler,
  });
}
