import type { FastifyRequest, FastifyReply } from 'fastify';
import { cartItemSchema, updateQuantitySchema } from './schema';
import { getCart, addItemToCart, updateItemQuantity, removeItemFromCart, clearCart, computeCartPricing, VariantNotFoundError } from './service';
import type { Cart } from './schema';

function sessionIdOf(req: FastifyRequest): string | null {
  const id = req.headers['x-session-id'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

// subtotal/autoAppliedDiscount/freeItems/shippingFee/total — every cart response
// carries the full pricing preview now, not just subtotal, so cart/checkout pages can
// display an accurate running total (and any free-gift line items) without recomputing
// (or worse, under-computing) discount logic client-side.
async function cartResponse(cart: Cart, reply: FastifyReply) {
  return reply.send({ ...cart, ...(await computeCartPricing(cart)) });
}

export async function getCartHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  const cart = await getCart(sessionId);
  return cartResponse(cart, reply);
}

export async function addItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  const parsed = cartItemSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const cart = await addItemToCart(sessionId, parsed.data);
    return cartResponse(cart, reply);
  } catch (err) {
    if (err instanceof VariantNotFoundError) return reply.code(404).send({ error: err.message });
    throw err;
  }
}

export async function updateItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  const { variantId } = req.params as { variantId: string };
  const parsed = updateQuantitySchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input' });

  const cart = await updateItemQuantity(sessionId, variantId, parsed.data.quantity);
  return cartResponse(cart, reply);
}

export async function removeItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  const { variantId } = req.params as { variantId: string };
  const cart = await removeItemFromCart(sessionId, variantId);
  return cartResponse(cart, reply);
}

export async function clearCartHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  await clearCart(sessionId);
  return reply.code(204).send();
}
