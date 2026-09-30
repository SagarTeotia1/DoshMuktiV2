import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { listCategoriesHandler, createCategoryHandler, updateCategoryHandler, deleteCategoryHandler } from './controller';

// Public category endpoints stay at /products/categories and /products/category-thumbs
// (products/routes.ts) — Frontend already calls those; only the admin CRUD lives here.
export async function categoriesRoutes(app: FastifyInstance) {
  app.get('/admin/categories', { preHandler: verifyAdmin }, listCategoriesHandler);
  app.post('/admin/categories', { preHandler: verifyAdmin }, createCategoryHandler);
  app.patch('/admin/categories/:id', { preHandler: verifyAdmin }, updateCategoryHandler);
  app.delete('/admin/categories/:id', { preHandler: verifyAdmin }, deleteCategoryHandler);
}
