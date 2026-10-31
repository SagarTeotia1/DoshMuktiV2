import type { FastifyInstance } from 'fastify';
import { optionalCustomer } from '../../shared/middleware/auth.middleware';
import { checkoutHandler, verifyPaymentHandler } from './controller';

export async function checkoutRoutes(app: FastifyInstance) {
  app.post('/checkout', {
    preHandler: optionalCustomer,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: checkoutHandler,
  });

  // No auth: guests pay too. The Razorpay HMAC signature checked in the handler is the proof.
  app.post('/checkout/verify', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    handler: verifyPaymentHandler,
  });
}
