import type { FastifyInstance } from 'fastify';
import { verifyAdmin, verifyCustomer } from '../../shared/middleware/auth.middleware';
import {
  trackOrderHandler,
  invoiceHandler,
  listOrdersByPhoneHandler,
  listMyOrdersHandler,
  listOrdersHandler,
  getOrderByIdHandler,
  updateOrderStatusHandler,
  gstReportHandler,
} from './controller';

export async function orderRoutes(app: FastifyInstance) {
  app.get('/orders/mine', { preHandler: verifyCustomer }, listMyOrdersHandler); // logged-in customer's own orders
  app.get('/orders', listOrdersByPhoneHandler); // public — list by phone (legacy/support lookup)
  app.get('/orders/:orderNumber', trackOrderHandler); // public — track by orderNumber
  app.get('/orders/:orderNumber/invoice', invoiceHandler); // public — PDF invoice, gated on payment.status === 'CAPTURED'
  app.get('/admin/orders', { preHandler: verifyAdmin }, listOrdersHandler);
  app.get('/admin/orders/gst-report', { preHandler: verifyAdmin }, gstReportHandler);
  app.get('/admin/orders/:id', { preHandler: verifyAdmin }, getOrderByIdHandler);
  app.patch('/admin/orders/:id/status', { preHandler: verifyAdmin }, updateOrderStatusHandler);
}
