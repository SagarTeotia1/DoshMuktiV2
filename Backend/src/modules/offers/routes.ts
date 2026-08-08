import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { listOffersHandler, createOfferHandler, updateOfferHandler, duplicateOfferHandler } from './controller';

export async function offersRoutes(app: FastifyInstance) {
  app.get('/admin/offers', { preHandler: verifyAdmin }, listOffersHandler);
  app.post('/admin/offers', { preHandler: verifyAdmin }, createOfferHandler);
  app.patch('/admin/offers/:id', { preHandler: verifyAdmin }, updateOfferHandler);
  app.post('/admin/offers/:id/duplicate', { preHandler: verifyAdmin }, duplicateOfferHandler);
}
