import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { chatHandler } from './controller';
import { listChatSessionsHandler, getChatSessionHandler, getChatVolumeHandler } from './adminController';

export async function chatRoutes(app: FastifyInstance) {
  // Public + costs real money per call — keep this tight regardless of how generous other routes are.
  app.post('/chat/acharya', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, chatHandler);

  // Admin visibility into Acharya Madhav sessions — who's chatting, from where, about what.
  app.get('/admin/chat-sessions', { preHandler: verifyAdmin }, listChatSessionsHandler);
  app.get('/admin/chat-sessions/volume', { preHandler: verifyAdmin }, getChatVolumeHandler);
  app.get('/admin/chat-sessions/:sessionId', { preHandler: verifyAdmin }, getChatSessionHandler);
}
