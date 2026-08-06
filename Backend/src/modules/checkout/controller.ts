import type { FastifyRequest, FastifyReply } from 'fastify';
import { checkoutSchema } from './schema';
import { initiateCheckout, OutOfStockError, NotServiceableError } from './service';
import { mapCouponValidationError } from '../coupons/controller';

export async function checkoutHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
  }

  try {
    const userId = (req.user as { sub: string }).sub;
    const result = await initiateCheckout(parsed.data, userId);
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
