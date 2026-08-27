import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import {
  listProductsHandler,
  getProductHandler,
  getFeaturedHandler,
  getCategoriesHandler,
  getCategoryThumbsHandler,
  getAdminCategoriesHandler,
  listAdminProductsHandler,
  getAdminProductHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
  addVariantHandler,
  updateVariantHandler,
} from './controller';

export async function productsRoutes(app: FastifyInstance) {
  app.get('/products', listProductsHandler);
  app.get('/products/featured', getFeaturedHandler);
  app.get('/products/categories', getCategoriesHandler);
  app.get('/products/category-thumbs', getCategoryThumbsHandler);
  app.get('/products/:slug', getProductHandler);

  app.get('/admin/products', { preHandler: verifyAdmin }, listAdminProductsHandler);
  app.get('/admin/products/categories', { preHandler: verifyAdmin }, getAdminCategoriesHandler);
  app.get('/admin/products/:id', { preHandler: verifyAdmin }, getAdminProductHandler);
  app.post('/admin/products', { preHandler: verifyAdmin }, createProductHandler);
  app.patch('/admin/products/:id', { preHandler: verifyAdmin }, updateProductHandler);
  app.delete('/admin/products/:id', { preHandler: verifyAdmin }, deleteProductHandler);
  app.post('/admin/products/:id/variants', { preHandler: verifyAdmin }, addVariantHandler);
  app.patch('/admin/variants/:id', { preHandler: verifyAdmin }, updateVariantHandler);
}
