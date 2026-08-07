import crypto from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkoutSchema, verifyPaymentSchema } from './schema';
import { initiateCheckout, OutOfStockError, NotServiceableError } from './service';
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

  try {
    const userId = (req.user as { sub: string }).sub;
    const result = await initiateCheckout(parsed.data, userId);

    // Best-effort: only clear the isolated Buy Now pseudo-cart (":buynow" suffix) —
    // it's always safe to drop immediately since it's disposable and re-cleared before
    // every future Buy Now attempt anyway. The real cart is deliberately NOT cleared
    // here: at this point the order is only PENDING_PAYMENT (see initiateCheckout) —
    // the customer hasn't paid yet, and may dismiss the Razorpay modal or have the
    // payment fail. Wiping their real cart before payment is confirmed would lose
    // those items for nothing. Clearing the real cart on actual payment success would
    // need to happen from the payment-captured webhook instead, which doesn't have a
    // session id to key off today.
    const sessionId = sessionIdOf(req);
    if (sessionId?.endsWith(':buynow')) {
      clearCart(sessionId).catch((err) => {
        logger.warn({ err, sessionId }, 'Failed to clear cart after successful checkout');
      });
    }

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

  await handlePaymentCaptured(razorpayOrderId, razorpayPaymentId);

  return reply.code(200).send({ verified: true });
}
