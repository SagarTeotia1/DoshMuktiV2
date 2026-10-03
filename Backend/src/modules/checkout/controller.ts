import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkoutSchema, verifyPaymentSchema } from './schema';
import { initiateCheckout, OutOfStockError, NotServiceableError, InvalidOrderTotalError, PaymentGatewayError } from './service';
import { redis } from '../../shared/cache/client';
import { cacheKeys } from '../../shared/cache/keys';
import { mapCouponValidationError } from '../coupons/controller';
import { clearCart } from '../cart/service';
import { handlePaymentCaptured } from '../webhooks/service';
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

  const userId = (req.user as { sub: string }).sub;

  // Double-click / double-submit guard: only one POST /checkout per customer in flight at
  // a time. TTL is a safety net — the lock is released in `finally` as soon as the request
  // finishes, so a deliberate retry right after a failure or a dismissed modal is not blocked.
  // Fails open: if Redis is unreachable, checkout must still work.
  const lockKey = cacheKeys.checkoutLock(userId);
  let lockHeld = false;
  try {
    lockHeld = (await redis.incr(lockKey, 20)) === 1;
  } catch (err) {
    logger.warn({ err }, 'Checkout lock unavailable — proceeding without it');
    lockHeld = true;
  }
  if (!lockHeld) {
    return reply.code(409).send({ error: 'Your order is already being placed. Please wait a moment.', code: 'CHECKOUT_IN_PROGRESS' });
  }

  try {
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
    if (err instanceof InvalidOrderTotalError) {
      return reply.code(409).send({ error: 'Order total is too low to pay online. Please add an item or remove the coupon.', code: 'ORDER_TOTAL_TOO_LOW' });
    }
    if (err instanceof PaymentGatewayError) {
      return reply.code(502).send({ error: 'Payment gateway is unavailable right now. Please try again in a minute.', code: 'PAYMENT_GATEWAY_ERROR' });
    }
    const couponError = mapCouponValidationError(err);
    if (couponError) {
      return reply.code(couponError.status).send({ error: couponError.message, code: couponError.code });
    }
    throw err;
  } finally {
    redis.del(lockKey).catch((err) => logger.warn({ err }, 'Failed to release checkout lock'));
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

  await handlePaymentCaptured(razorpayOrderId, razorpayPaymentId);

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
