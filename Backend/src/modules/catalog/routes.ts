import type { FastifyInstance } from 'fastify';
import { getCatalogFeedHandler } from './controller';

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/catalog.csv', getCatalogFeedHandler);
}
