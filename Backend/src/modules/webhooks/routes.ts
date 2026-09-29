import type { FastifyInstance } from 'fastify';
import { razorpayWebhookHandler, hdfcWebhookHandler, delhiveryWebhookHandler } from './controller';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/razorpay', razorpayWebhookHandler);
  app.post('/webhooks/hdfc-smartgateway', hdfcWebhookHandler);
  app.post('/webhooks/delhivery', delhiveryWebhookHandler);
}
