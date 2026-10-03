import type { FastifyInstance } from 'fastify';
import { ekartWebhookHandler, razorpayWebhookHandler, delhiveryWebhookHandler } from './controller';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/razorpay', razorpayWebhookHandler);
  app.post('/webhooks/delhivery', delhiveryWebhookHandler);
  app.post('/webhooks/ekart', ekartWebhookHandler);
}
