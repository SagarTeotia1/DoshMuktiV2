import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env';
import { handleEkartStatusUpdate, handlePaymentCaptured, handlePaymentFailed, handleDelhiveryStatusUpdate } from './service';

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
    await handlePaymentCaptured(order_id, id);
  } else if (event.event === 'payment.failed') {
    const { order_id, error_description } = event.payload.payment.entity;
    await handlePaymentFailed(order_id, error_description ?? 'Payment failed');
  }
}

// Ekart track_updated push. Auth: the ?token=... we put in the webhook URL when
// registering it (Ekart's spec documents an HMAC secret but not the signature header, so
// a URL token is what we can verify) - constant-time compared, never ===.
export async function ekartWebhookHandler(req: FastifyRequest, reply: FastifyReply) {
  const token = (req.query as { token?: string }).token ?? '';
  const tokenBuf = Buffer.from(token);
  const expBuf = Buffer.from(env.EKART_WEBHOOK_TOKEN);
  if (!env.EKART_WEBHOOK_TOKEN || tokenBuf.length !== expBuf.length || !crypto.timingSafeEqual(tokenBuf, expBuf)) {
    return reply.code(401).send({ error: 'Invalid token' });
  }

  const body = req.body as { id?: string; status?: string; location?: string; desc?: string; ctime?: number } | undefined;
  if (!body?.id || !body.status) return reply.code(400).send({ error: 'Invalid payload' });

  // Ack first - Ekart retries on slow responses.
  reply.code(200).send({ status: 'ok' });
  await handleEkartStatusUpdate(body.id, {
    status: body.status,
    location: body.location ?? '',
    description: body.desc ?? '',
    timestamp: new Date(body.ctime ?? Date.now()).toISOString(),
  });
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
