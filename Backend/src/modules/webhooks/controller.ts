import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env';
import { verifyWebhookBasicAuth } from '../../shared/integrations/hdfc-smartgateway/client';
import { handlePaymentCaptured, handlePaymentFailed, handleDelhiveryStatusUpdate } from './service';

interface SmartGatewayWebhookBody {
  id: string;
  event_name: string;
  content: {
    order: {
      order_id: string;
      status: string;
      txn_id?: string;
      id?: string;
    };
  };
}

// Auth is HTTP Basic (dashboard-configured username/password) — see
// verifyWebhookBasicAuth. This is a durability backstop for /checkout/return (which
// never fires if the customer closes the tab before the bank redirects them back) —
// handlePaymentCaptured/handlePaymentFailed are idempotent, so whichever path arrives
// first wins and the other is a no-op.
export async function hdfcWebhookHandler(req: FastifyRequest, reply: FastifyReply) {
  if (!verifyWebhookBasicAuth(req.headers.authorization)) {
    return reply.code(401).send({ error: 'Invalid credentials' });
  }

  // Ack before processing — SmartGateway retries if no 200 within a few seconds
  reply.code(200).send({ status: 'ok' });

  const event = req.body as SmartGatewayWebhookBody;
  const order = event.content?.order;
  if (!order) return;

  if (event.event_name === 'ORDER_SUCCEEDED') {
    await handlePaymentCaptured(order.order_id, order.txn_id ?? order.id ?? order.order_id);
  } else if (event.event_name === 'ORDER_FAILED') {
    await handlePaymentFailed(order.order_id, `SmartGateway order status: ${order.status}`);
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
