import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { uploadImageHandler } from './controller';

export async function uploadRoutes(app: FastifyInstance) {
  // Requires @fastify/multipart registered in app.ts — see note in docs/PATTERNS.md
  app.post('/admin/upload', { preHandler: verifyAdmin }, uploadImageHandler);
}
