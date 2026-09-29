import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env';
import { verifyWebhookBasicAuth } from '../../shared/integrations/hdfc-smartgateway/client';
import { handlePaymentCaptured, handlePaymentFailed, handleDelhiveryStatusUpdate } from './service';

interface RawBodyRequest extends FastifyRequest {
  rawBody?: string;
}

export async function razorpayWebhookHandler(req: RawBodyRequest, reply: FastifyReply) {
  const rawBody = req.rawBody ?? JSON.stringify(req.body);
  const signature = req.headers['x-razorpay-signature'] as string | undefined;

  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature ?? '', 'hex');
  const expBuf = Buffer.from(expected, 'hex');

  if (!signature || sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return reply.code(401).send({ error: 'Invalid signature' });
  }

  // Ack before processing — Razorpay retries if no 200 within 5s
  reply.code(200).send({ status: 'ok' });

  const event = req.body as { event: string; payload: { payment: { entity: { order_id: string; id: string; error_description?: string } } } };

  if (event.event === 'payment.captured') {
    const { order_id, id } = event.payload.payment.entity;
    await handlePaymentCaptured('RAZORPAY', order_id, id);
  } else if (event.event === 'payment.failed') {
    const { order_id, error_description } = event.payload.payment.entity;
    await handlePaymentFailed('RAZORPAY', order_id, error_description ?? 'Payment failed');
  }
}

interface SmartGatewayWebhookBody {
  id: string;
  event_name: string;
  content: { order: { order_id: string; status: string; txn_id?: string; id?: string } };
}

// Auth is HTTP Basic (dashboard-configured username/password), not HMAC. Durability
// backstop for /checkout/return, which never fires if the customer closes the tab before
// the bank redirects them back — handlers are idempotent, so whichever arrives first wins.
export async function hdfcWebhookHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!verifyWebhookBasicAuth(req.headers.authorization)) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }

  // Ack before processing — SmartGateway retries if no 200 within a few seconds
  reply.code(200).send({ status: 'ok' });

  const order = (req.body as SmartGatewayWebhookBody).content?.order;
  if (!order) return;
  const event = (req.body as SmartGatewayWebhookBody).event_name;

  if (event === 'ORDER_SUCCEEDED') {
    await handlePaymentCaptured('HDFC', order.order_id, order.txn_id ?? order.id ?? order.order_id);
  } else if (event === 'ORDER_FAILED') {
    await handlePaymentFailed('HDFC', order.order_id, `SmartGateway order status: ${order.status}`);
  }
}

export async function delhiveryWebhookHandler(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers['x-delhivery-token'] as string | undefined;
  const tokenBuf = Buffer.from(token ?? '');
  const expBuf = Buffer.from(env.DELHIVERY_WEBHOOK_TOKEN);
  if (!token || tokenBuf.length !== expBuf.length || !crypto.timingSafeEqual(tokenBuf, expBuf)) {
    return reply.code(401).send({ error: 'Invalid token' });
  }

  const body = req.body as { Shipment?: { AWB: string; Status: { Status: string; StatusLocation: string; Instructions: string; StatusDateTime: string } } };
  const shipment = body.Shipment;
  if (!shipment) return reply.code(400).send({ error: 'Invalid payload' });

  await handleDelhiveryStatusUpdate(shipment.AWB, {
    status: shipment.Status.Status,
    location: shipment.Status.StatusLocation,
    description: shipment.Status.Instructions,
    timestamp: shipment.Status.StatusDateTime,
  });

  return reply.code(200).send({ status: 'ok' });
}
