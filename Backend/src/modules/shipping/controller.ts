import type { FastifyRequest, FastifyReply } from 'fastify';
import { rateCalcQuerySchema, shippingEstimateQuerySchema } from './schema';
import { calculateShippingCost } from '../../shared/integrations/delhivery/client';
import { calculateShippingFee } from '../checkout/service';
import { env } from '../../config/env';

// Read-only — the warehouse is created/edited directly on Delhivery's own dashboard
// (already done once, manually), never through this app. This just echoes the config
// this Backend is actually using, so Admin can confirm it matches what's on Delhivery.
export async function warehouseHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    name: env.DELHIVERY_WAREHOUSE_NAME,
    phone: env.DELHIVERY_WAREHOUSE_PHONE,
    address: env.DELHIVERY_WAREHOUSE_ADDRESS,
    city: env.DELHIVERY_WAREHOUSE_CITY,
    state: env.DELHIVERY_WAREHOUSE_STATE,
    pincode: env.DELHIVERY_WAREHOUSE_PINCODE,
  });
}

export async function rateCalcHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = rateCalcQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });

  const result = await calculateShippingCost({
    originPincode: env.DELHIVERY_WAREHOUSE_PINCODE,
    destPincode: parsed.data.destPincode,
    weightGrams: parsed.data.weightGrams,
    paymentMode: parsed.data.paymentMode,
  });
  if (!result) return reply.code(502).send({ error: 'Delhivery did not return a rate for this route' });

  return reply.send(result);
}

// Public (storefront) — shows a shipping-charge estimate on the product page for a
// single item's price+weight, before the customer knows their own cart total or
// address. Same origin-to-origin estimate the cart preview uses (see cart/service.ts).
export async function shippingEstimateHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = shippingEstimateQuerySchema.safeParse(req.query);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });

  const { fee, originalFee } = await calculateShippingFee(
    parsed.data.subtotal,
    parsed.data.weightGrams,
    env.DELHIVERY_WAREHOUSE_PINCODE
  );
  return reply.send({ fee, originalFee });
}
