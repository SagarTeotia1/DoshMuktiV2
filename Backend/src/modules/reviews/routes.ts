import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import {
  createReviewHandler,
  getProductReviewsHandler,
  getRecentReviewsHandler,
  adminListReviewsHandler,
  adminModerateReviewHandler,
} from './controller';

export async function reviewsRoutes(app: FastifyInstance) {
  app.post('/reviews', createReviewHandler);
  app.get('/reviews/recent', getRecentReviewsHandler);
  app.get('/products/:slug/reviews', getProductReviewsHandler);

  app.get('/admin/reviews', { preHandler: verifyAdmin }, adminListReviewsHandler);
  app.patch('/admin/reviews/:id', { preHandler: verifyAdmin }, adminModerateReviewHandler);
}
