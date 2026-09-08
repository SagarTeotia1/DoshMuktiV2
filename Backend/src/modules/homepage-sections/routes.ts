import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import {
  getActiveHomepageSectionsHandler,
  listHomepageSectionsHandler,
  createHomepageSectionHandler,
  updateHomepageSectionHandler,
  setHomepageSectionItemsHandler,
  deleteHomepageSectionHandler,
} from './controller';

export async function homepageSectionsRoutes(app: FastifyInstance) {
  app.get('/homepage-sections', getActiveHomepageSectionsHandler);

  app.get('/admin/homepage-sections', { preHandler: verifyAdmin }, listHomepageSectionsHandler);
  app.post('/admin/homepage-sections', { preHandler: verifyAdmin }, createHomepageSectionHandler);
  app.patch('/admin/homepage-sections/:id', { preHandler: verifyAdmin }, updateHomepageSectionHandler);
  app.put('/admin/homepage-sections/:id/items', { preHandler: verifyAdmin }, setHomepageSectionItemsHandler);
  app.delete('/admin/homepage-sections/:id', { preHandler: verifyAdmin }, deleteHomepageSectionHandler);
}
