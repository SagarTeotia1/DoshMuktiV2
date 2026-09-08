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
  ndrActionHandler,
  ewaybillUpdateHandler,
  riskFlagHandler,
} from './controller';

const publicOrderRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

export async function orderRoutes(app: FastifyInstance) {
  app.get('/orders/mine', { preHandler: verifyCustomer }, listMyOrdersHandler); // logged-in customer's own orders
  app.get('/orders', { config: publicOrderRateLimit }, listOrdersByPhoneHandler); // public — list by phone (legacy/support lookup)
  app.get('/orders/:orderNumber', { config: publicOrderRateLimit }, trackOrderHandler); // public — track by orderNumber
  app.get('/orders/:orderNumber/invoice', { config: publicOrderRateLimit }, invoiceHandler); // public — PDF invoice, gated on payment.status === 'CAPTURED'
  app.post('/orders/:orderNumber/resume', { config: publicOrderRateLimit }, resumeOrderHandler); // public — re-adds a PENDING_PAYMENT order's items into the caller's cart so checkout can be retried
  app.get('/admin/orders', { preHandler: verifyAdmin }, listOrdersHandler);
  app.get('/admin/orders/gst-report', { preHandler: verifyAdmin }, gstReportHandler);
  app.get('/admin/orders/:id', { preHandler: verifyAdmin }, getOrderByIdHandler);
  app.patch('/admin/orders/:id/status', { preHandler: verifyAdmin }, updateOrderStatusHandler);
  app.get('/admin/orders/:id/shipment/label', { preHandler: verifyAdmin }, shipmentLabelHandler);
  app.post('/admin/orders/:id/shipment/book', { preHandler: verifyAdmin }, bookShipmentHandler);
  app.post('/admin/orders/:id/shipment/ndr', { preHandler: verifyAdmin }, ndrActionHandler);
  app.post('/admin/orders/:id/shipment/ewaybill', { preHandler: verifyAdmin }, ewaybillUpdateHandler);
  app.patch('/admin/orders/:id/shipment/risk-flag', { preHandler: verifyAdmin }, riskFlagHandler);
}
