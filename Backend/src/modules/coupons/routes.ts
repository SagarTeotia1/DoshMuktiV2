import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import {
  listCouponsHandler,
  getCouponHandler,
  createCouponHandler,
  updateCouponHandler,
  previewCouponHandler,
  suggestedCouponsHandler,
} from './controller';

export async function couponsRoutes(app: FastifyInstance) {
  app.get('/admin/coupons', { preHandler: verifyAdmin }, listCouponsHandler);
  app.post('/admin/coupons', { preHandler: verifyAdmin }, createCouponHandler);
  app.get('/admin/coupons/:id', { preHandler: verifyAdmin }, getCouponHandler);
  app.patch('/admin/coupons/:id', { preHandler: verifyAdmin }, updateCouponHandler);

  // Public, unauthenticated — same tier as /serviceability, /products.
  app.post('/coupon/preview', { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, previewCouponHandler);
  app.get('/coupons/suggestions', suggestedCouponsHandler);
}
