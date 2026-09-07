import type { FastifyInstance } from 'fastify';
import { verifyCustomer } from '../../shared/middleware/auth.middleware';
import { listAddressesHandler, createAddressHandler, deleteAddressHandler } from './controller';

export async function addressRoutes(app: FastifyInstance) {
  app.get('/addresses', { preHandler: verifyCustomer }, listAddressesHandler);
  app.post('/addresses', { preHandler: verifyCustomer }, createAddressHandler);
  app.delete('/addresses/:id', { preHandler: verifyCustomer }, deleteAddressHandler);
}
