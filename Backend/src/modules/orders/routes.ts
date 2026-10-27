import type { FastifyInstance } from 'fastify';
import { verifyAdmin, verifyCustomer } from '../../shared/middleware/auth.middleware';
import {
  trackOrderHandler,
  resumeOrderHandler,
  invoiceHandler,
  listOrdersByPhoneHandler,
  lookupOrderHandler,
  listMyOrdersHandler,
  listOrdersHandler,
  getOrderByIdHandler,
  updateOrderStatusHandler,
  gstReportHandler,
  shipmentLabelHandler,
  bookShipmentHandler,
  resendWhatsAppConfirmationHandler,
  syncTrackingHandler,
  ndrActionHandler,
  ewaybillUpdateHandler,
  riskFlagHandler,
  packageWeightHandler,
} from './controller';

const publicOrderRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

export async function orderRoutes(app: FastifyInstance) {
  app.get('/orders/mine', { preHandler: verifyCustomer }, listMyOrdersHandler); // logged-in customer's own orders
  // Public order URLs are keyed by Order.publicToken (16 random hex), NOT the sequential orderNumber —
  // anyone holding the link can view it (shareable), nobody can walk 0020 -> 0021 to read other orders.
  app.post('/orders/lookup', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, lookupOrderHandler); // orderNumber + phone -> token
  app.get('/orders/:token', { config: publicOrderRateLimit }, trackOrderHandler); // public — track by token
  app.get('/orders/:token/invoice', { config: publicOrderRateLimit }, invoiceHandler); // public — PDF invoice, gated on payment.status === 'CAPTURED'
  app.post('/orders/:token/resume', { config: publicOrderRateLimit }, resumeOrderHandler); // public — re-adds a PENDING_PAYMENT order's items into the caller's cart so checkout can be retried
  app.get('/admin/orders/by-phone', { preHandler: verifyAdmin }, listOrdersByPhoneHandler); // support lookup — was public and returned every order for any phone
  app.get('/admin/orders', { preHandler: verifyAdmin }, listOrdersHandler);
  app.get('/admin/orders/gst-report', { preHandler: verifyAdmin }, gstReportHandler);
  app.post('/admin/orders/sync-tracking', { preHandler: verifyAdmin }, syncTrackingHandler);
  app.get('/admin/orders/:id', { preHandler: verifyAdmin }, getOrderByIdHandler);
  app.patch('/admin/orders/:id/status', { preHandler: verifyAdmin }, updateOrderStatusHandler);
  app.get('/admin/orders/:id/shipment/label', { preHandler: verifyAdmin }, shipmentLabelHandler);
  app.post('/admin/orders/:id/shipment/book', { preHandler: verifyAdmin }, bookShipmentHandler);
  app.post('/admin/orders/:id/whatsapp-confirmation', { preHandler: verifyAdmin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, resendWhatsAppConfirmationHandler);
  app.post('/admin/orders/:id/shipment/ndr', { preHandler: verifyAdmin }, ndrActionHandler);
  app.post('/admin/orders/:id/shipment/ewaybill', { preHandler: verifyAdmin }, ewaybillUpdateHandler);
  app.patch('/admin/orders/:id/shipment/risk-flag', { preHandler: verifyAdmin }, riskFlagHandler);
  app.patch('/admin/orders/:id/package-weight', { preHandler: verifyAdmin }, packageWeightHandler);
}
