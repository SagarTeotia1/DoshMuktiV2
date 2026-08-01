import type { FastifyInstance } from 'fastify';
import { razorpayWebhookHandler, delhiveryWebhookHandler } from './controller';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/razorpay', razorpayWebhookHandler);
  app.post('/webhooks/delhivery', delhiveryWebhookHandler);
}
