import type { FastifyInstance } from 'fastify';
import { hdfcWebhookHandler, delhiveryWebhookHandler } from './controller';

export async function webhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/hdfc-smartgateway', hdfcWebhookHandler);
  app.post('/webhooks/delhivery', delhiveryWebhookHandler);
}
