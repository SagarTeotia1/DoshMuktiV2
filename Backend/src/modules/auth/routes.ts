import type { FastifyInstance } from 'fastify';
import { verifyCustomer } from '../../shared/middleware/auth.middleware';
import { adminLoginHandler, sendOtpHandler, verifyOtpHandler, meHandler } from './controller';

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/admin/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    handler: adminLoginHandler,
  });

  app.post('/auth/otp/send', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    handler: sendOtpHandler,
  });

  app.post('/auth/otp/verify', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: verifyOtpHandler,
  });

  app.get('/auth/me', { preHandler: verifyCustomer }, meHandler);
}
