import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import {
  listProductsHandler,
  getProductHandler,
  getFeaturedHandler,
  listAdminProductsHandler,
  getAdminProductHandler,
  createProductHandler,
  updateProductHandler,
  addVariantHandler,
  updateVariantHandler,
} from './controller';

export async function productsRoutes(app: FastifyInstance) {
  app.get('/products', listProductsHandler);
  app.get('/products/featured', getFeaturedHandler);
  app.get('/products/:slug', getProductHandler);

  app.get('/admin/products', { preHandler: verifyAdmin }, listAdminProductsHandler);
  app.get('/admin/products/:id', { preHandler: verifyAdmin }, getAdminProductHandler);
  app.post('/admin/products', { preHandler: verifyAdmin }, createProductHandler);
  app.patch('/admin/products/:id', { preHandler: verifyAdmin }, updateProductHandler);
  app.post('/admin/products/:id/variants', { preHandler: verifyAdmin }, addVariantHandler);
  app.patch('/admin/variants/:id', { preHandler: verifyAdmin }, updateVariantHandler);
}
