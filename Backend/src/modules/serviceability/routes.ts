import type { FastifyInstance } from 'fastify';
import { checkServiceabilityHandler } from './controller';

export async function serviceabilityRoutes(app: FastifyInstance) {
  app.get('/serviceability', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    handler: checkServiceabilityHandler,
  });
}
