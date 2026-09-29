import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkoutSchema, verifyPaymentSchema, returnUrlSchema } from './schema';
import { initiateCheckout, OutOfStockError, NotServiceableError, PaymentGatewayError } from './service';
import { getOrderStatus, verifyReturnUrlSignature } from '../../shared/integrations/hdfc-smartgateway/client';
import { mapCouponValidationError } from '../coupons/controller';
import { clearCart } from '../cart/service';
import { handlePaymentCaptured, handlePaymentFailed } from '../webhooks/service';
import { logger } from '../../shared/logger/pino';
import { env } from '../../config/env';

function sessionIdOf(req: FastifyRequest): string | null {
  const id = req.headers['x-session-id'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export async function checkoutHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
  }

  try {
    const userId = (req.user as { sub: string }).sub;
    const result = await initiateCheckout(parsed.data, userId);

    // Buy Now pseudo-cart is intentionally left untouched here — the order created by
    // initiateCheckout is only PENDING_PAYMENT, and the customer may still dismiss the
    // Razorpay modal or have the payment fail. Clearing it at this point (as this used
    // to do) emptied the checkout page's item list the moment "Pay Now" was pressed,
    // so a cancelled/failed payment left the Buy Now screen showing nothing to retry —
    // see verifyPaymentHandler below, which now clears it only once payment actually
    // succeeds, matching how the real cart is already handled.

    return reply.code(201).send(result);
  } catch (err) {
    if (err instanceof OutOfStockError) {
      return reply.code(409).send({ error: 'Item out of stock', code: 'OUT_OF_STOCK', variantId: err.variantId });
    }
    if (err instanceof NotServiceableError) {
      return reply.code(409).send({ error: 'Pincode not serviceable', code: 'NOT_SERVICEABLE', pincode: err.pincode });
    }
    const couponError = mapCouponValidationError(err);
    if (couponError) {
      return reply.code(couponError.status).send({ error: couponError.message, code: couponError.code });
    }
    if (err instanceof PaymentGatewayError) {
      logger.error({ err }, 'SmartGateway order session creation failed');
      return reply.code(502).send({ error: 'Payment gateway is temporarily unavailable — please try again', code: 'PAYMENT_GATEWAY_ERROR' });
    }
    throw err;
  }
}

// Fast, client-driven confirmation path: checkout.js hands the client these three values
// immediately on payment success. We verify them synchronously here so the order flips to
// PAID without waiting on Razorpay's server-to-server webhook (which never fires on
// localhost / without a public webhook URL configured). The webhook in modules/webhooks
// stays in place as a durability backstop — handlePaymentCaptured is idempotent, so whichever
// path arrives first wins and the other is a no-op.
export async function verifyPaymentHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = verifyPaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const sigBuf = Buffer.from(razorpaySignature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return reply.code(401).send({ error: 'Invalid payment signature' });
  }

  await handlePaymentCaptured('RAZORPAY', razorpayOrderId, razorpayPaymentId);

  // Only now — payment actually confirmed — is it safe to drop the Buy Now pseudo-cart.
  // The real cart is still deliberately left alone (see handlePaymentCaptured's webhook
  // counterpart, which doesn't have a session id to key off).
  const sessionId = sessionIdOf(req);
  if (sessionId?.endsWith(':buynow')) {
    clearCart(sessionId).catch((err) => {
      logger.warn({ err, sessionId }, 'Failed to clear cart after successful checkout');
    });
  }

  return reply.code(200).send({ verified: true });
}

// HDFC SmartGateway redirects the customer's browser here (GET) after the bank's hosted
// payment page. The redirect is spoofable, so its signature is only a hint — the
// authoritative source is always the server-to-server Order Status call below.
// handlePaymentCaptured/Failed are idempotent; the webhook is the durability backstop.
// Anything not CHARGED and not known-in-progress is treated as failed (recoverable via
// the "Complete Payment" retry flow) rather than left stuck PENDING_PAYMENT.
const IN_PROGRESS_STATUSES = new Set(['NEW', 'PENDING', 'PENDING_VBV', 'STARTED', 'AUTHORIZING', 'CAPTURE_INITIATED']);

export async function returnUrlHandler(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as Record<string, unknown>;
  const parsed = returnUrlSchema.safeParse(query);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid return_url params', details: parsed.error.flatten().fieldErrors });
  }
  const { order_id: orderId } = parsed.data;

  if (!verifyReturnUrlSignature(query)) {
    logger.warn({ orderId }, 'SmartGateway return_url signature mismatch — falling back to order-status API as source of truth');
  }

  let finalStatus: string;
  try {
    const status = await getOrderStatus(orderId);
    finalStatus = status.status;
    if (status.status === 'CHARGED') {
      await handlePaymentCaptured('HDFC', orderId, status.txnId ?? orderId);
      const sessionId = sessionIdOf(req);
      if (sessionId?.endsWith(':buynow')) {
        clearCart(sessionId).catch((err) => {
          logger.warn({ err, sessionId }, 'Failed to clear cart after successful checkout');
        });
      }
    } else if (!IN_PROGRESS_STATUSES.has(status.status)) {
      await handlePaymentFailed('HDFC', orderId, `SmartGateway order status: ${status.status}`);
    }
  } catch (err) {
    logger.error({ err, orderId }, 'Order Status API call failed while handling SmartGateway return_url');
    finalStatus = 'PENDING';
  }

  const destination =
    finalStatus === 'CHARGED'
      ? `${env.FRONTEND_ORIGIN[0]}/checkout/success?orderNumber=${encodeURIComponent(orderId)}`
      : `${env.FRONTEND_ORIGIN[0]}/track/${encodeURIComponent(orderId)}`;

  return reply.redirect(destination);
}
