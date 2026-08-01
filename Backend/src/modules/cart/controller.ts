import type { FastifyRequest, FastifyReply } from 'fastify';
import { cartItemSchema, updateQuantitySchema } from './schema';
import { getCart, addItemToCart, updateItemQuantity, removeItemFromCart, clearCart, cartSubtotal, VariantNotFoundError } from './service';

function sessionIdOf(req: FastifyRequest): string | null {
  const id = req.headers['x-session-id'];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export async function getCartHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  const cart = await getCart(sessionId);
  return reply.send({ ...cart, subtotal: cartSubtotal(cart) });
}

export async function addItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  const parsed = cartItemSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  try {
    const cart = await addItemToCart(sessionId, parsed.data);
    return reply.send({ ...cart, subtotal: cartSubtotal(cart) });
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
  return reply.send({ ...cart, subtotal: cartSubtotal(cart) });
}

export async function removeItemHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  const { variantId } = req.params as { variantId: string };
  const cart = await removeItemFromCart(sessionId, variantId);
  return reply.send({ ...cart, subtotal: cartSubtotal(cart) });
}

export async function clearCartHandler(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = sessionIdOf(req);
  if (!sessionId) return reply.code(400).send({ error: 'Missing x-session-id header' });

  await clearCart(sessionId);
  return reply.code(204).send();
}
