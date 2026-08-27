import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { getActiveBannersHandler, listBannersHandler, createBannerHandler, updateBannerHandler, deleteBannerHandler } from './controller';

export async function bannersRoutes(app: FastifyInstance) {
  app.get('/banners', getActiveBannersHandler);

  app.get('/admin/banners', { preHandler: verifyAdmin }, listBannersHandler);
  app.post('/admin/banners', { preHandler: verifyAdmin }, createBannerHandler);
  app.patch('/admin/banners/:id', { preHandler: verifyAdmin }, updateBannerHandler);
  app.delete('/admin/banners/:id', { preHandler: verifyAdmin }, deleteBannerHandler);
}
