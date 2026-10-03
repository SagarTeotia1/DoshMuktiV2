import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env';
import { logger } from '../../shared/logger/pino';
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

  const event = req.body as { event: string; payload: { payment: { entity: { order_id: string; id: string; error_description?: string } } } };

  // Process BEFORE acking. Acking first meant a DB blip during processing was swallowed —
  // Razorpay had already got its 200, so it never redelivered, and the paid order stayed
  // PENDING_PAYMENT. Both handlers are idempotent and DB-only (shipment booking / email are
  // fire-and-forget inside them), so this stays well inside Razorpay's response window, and
  // a non-2xx makes Razorpay redeliver the event.
  try {
    if (event.event === 'payment.captured') {
      const { order_id, id } = event.payload.payment.entity;
      await handlePaymentCaptured(order_id, id);
    } else if (event.event === 'payment.failed') {
      const { order_id, error_description } = event.payload.payment.entity;
      await handlePaymentFailed(order_id, error_description ?? 'Payment failed');
    }
  } catch (err) {
    logger.error({ err, event: event.event }, 'Razorpay webhook processing failed — asking Razorpay to retry');
    return reply.code(500).send({ error: 'Processing failed' });
  }

  return reply.code(200).send({ status: 'ok' });
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
