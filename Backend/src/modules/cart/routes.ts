import type { FastifyInstance } from 'fastify';
import { getCartHandler, addItemHandler, updateItemHandler, removeItemHandler, clearCartHandler } from './controller';

export async function cartRoutes(app: FastifyInstance) {
  app.get('/cart', getCartHandler);
  app.post('/cart/items', addItemHandler);
  app.patch('/cart/items/:variantId', updateItemHandler);
  app.delete('/cart/items/:variantId', removeItemHandler);
  app.delete('/cart', clearCartHandler);
}
