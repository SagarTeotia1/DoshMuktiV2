import type { FastifyInstance } from 'fastify';
import { adminLoginHandler } from './controller';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/admin/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    handler: adminLoginHandler,
  });
}
