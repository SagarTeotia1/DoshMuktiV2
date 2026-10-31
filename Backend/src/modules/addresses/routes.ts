import type { FastifyInstance } from 'fastify';
import { verifyCustomer } from '../../shared/middleware/auth.middleware';
import { listAddressesHandler, createAddressHandler, updateAddressHandler, deleteAddressHandler, lookupAddressHandler } from './controller';

export async function addressRoutes(app: FastifyInstance) {
  app.get('/addresses/lookup', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } }, handler: lookupAddressHandler });
  app.get('/addresses', { preHandler: verifyCustomer }, listAddressesHandler);
  app.post('/addresses', { preHandler: verifyCustomer }, createAddressHandler);
  app.patch('/addresses/:id', { preHandler: verifyCustomer }, updateAddressHandler);
  app.delete('/addresses/:id', { preHandler: verifyCustomer }, deleteAddressHandler);
}
