import type { FastifyInstance } from 'fastify';
import { chatHandler } from './controller';

export async function chatRoutes(app: FastifyInstance) {
  // Public + costs real money per call — keep this tight regardless of how generous other routes are.
  app.post('/chat/acharya', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, chatHandler);
}
