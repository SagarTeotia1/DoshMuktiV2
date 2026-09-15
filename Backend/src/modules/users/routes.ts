import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { listUsersHandler, getUserByIdHandler } from './controller';

export async function usersRoutes(app: FastifyInstance) {
  app.get('/admin/users', { preHandler: verifyAdmin }, listUsersHandler);
  app.get('/admin/users/:id', { preHandler: verifyAdmin }, getUserByIdHandler);
}
