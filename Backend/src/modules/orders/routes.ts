import type { FastifyInstance } from 'fastify';
import { verifyAdmin, verifyCustomer } from '../../shared/middleware/auth.middleware';
import {
  trackOrderHandler,
  resumeOrderHandler,
  invoiceHandler,
  listOrdersByPhoneHandler,
  listMyOrdersHandler,
  listOrdersHandler,
  getOrderByIdHandler,
  updateOrderStatusHandler,
  gstReportHandler,
  shipmentLabelHandler,
  bookShipmentHandler,
  raisePickupHandler,
  ndrActionHandler,
  ewaybillUpdateHandler,
} from './controller';

export async function orderRoutes(app: FastifyInstance) {
  app.get('/orders/mine', { preHandler: verifyCustomer }, listMyOrdersHandler); // logged-in customer's own orders
  app.get('/orders', listOrdersByPhoneHandler); // public — list by phone (legacy/support lookup)
  app.get('/orders/:orderNumber', trackOrderHandler); // public — track by orderNumber
  app.get('/orders/:orderNumber/invoice', invoiceHandler); // public — PDF invoice, gated on payment.status === 'CAPTURED'
  app.post('/orders/:orderNumber/resume', resumeOrderHandler); // public — re-adds a PENDING_PAYMENT order's items into the caller's cart so checkout can be retried
  app.get('/admin/orders', { preHandler: verifyAdmin }, listOrdersHandler);
  app.get('/admin/orders/gst-report', { preHandler: verifyAdmin }, gstReportHandler);
  app.get('/admin/orders/:id', { preHandler: verifyAdmin }, getOrderByIdHandler);
  app.patch('/admin/orders/:id/status', { preHandler: verifyAdmin }, updateOrderStatusHandler);
  app.get('/admin/orders/:id/shipment/label', { preHandler: verifyAdmin }, shipmentLabelHandler);
  app.post('/admin/orders/:id/shipment/book', { preHandler: verifyAdmin }, bookShipmentHandler);
  app.post('/admin/orders/:id/shipment/pickup', { preHandler: verifyAdmin }, raisePickupHandler);
  app.post('/admin/orders/:id/shipment/ndr', { preHandler: verifyAdmin }, ndrActionHandler);
  app.post('/admin/orders/:id/shipment/ewaybill', { preHandler: verifyAdmin }, ewaybillUpdateHandler);
}
