import { db } from '../../shared/db/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import type { Cart, CartItem } from './schema';

export class VariantNotFoundError extends Error {
  constructor(public variantId: string) {
    super(`Variant not found: ${variantId}`);
    this.name = 'VariantNotFoundError';
  }
}

export async function getCart(sessionId: string): Promise<Cart> {
  const cached = await redis.get<Cart>(cacheKeys.cart(sessionId));
  if (cached) return cached;
  return { sessionId, items: [], updatedAt: new Date().toISOString() };
}

async function saveCart(cart: Cart): Promise<Cart> {
  cart.updatedAt = new Date().toISOString();
  await redis.set(cacheKeys.cart(cart.sessionId), cart, { ex: CACHE_TTL.CART });
  return cart;
}

export async function addItemToCart(sessionId: string, input: { variantId: string; quantity: number }): Promise<Cart> {
  const variant = await db.productVariant.findFirst({
    where: { id: input.variantId, isActive: true },
    include: { product: { select: { name: true, basePrice: true } } },
  });
  if (!variant) throw new VariantNotFoundError(input.variantId);

  const cart = await getCart(sessionId);
  const price = Number(variant.priceOverride ?? variant.product.basePrice);
  const existingIndex = cart.items.findIndex((i) => i.variantId === input.variantId);

  const item: CartItem = {
    variantId: input.variantId,
    quantity: input.quantity,
    price,
    maxStock: variant.stockQuantity,
    productName: variant.product.name,
    sku: variant.sku,
  };

  if (existingIndex >= 0) {
    const existing = cart.items[existingIndex]!;
    cart.items[existingIndex] = { ...item, quantity: Math.min(existing.quantity + input.quantity, variant.stockQuantity) };
  } else {
    cart.items.push({ ...item, quantity: Math.min(input.quantity, variant.stockQuantity) });
  }

  return saveCart(cart);
}

export async function updateItemQuantity(sessionId: string, variantId: string, quantity: number): Promise<Cart> {
  const cart = await getCart(sessionId);
  const index = cart.items.findIndex((i) => i.variantId === variantId);
  if (index < 0) return cart;

  if (quantity <= 0) {
    cart.items.splice(index, 1);
    return saveCart(cart);
  }

  const item = cart.items[index]!;
  cart.items[index] = { ...item, quantity: Math.min(quantity, item.maxStock) };
  return saveCart(cart);
}

export async function removeItemFromCart(sessionId: string, variantId: string): Promise<Cart> {
  const cart = await getCart(sessionId);
  cart.items = cart.items.filter((i) => i.variantId !== variantId);
  return saveCart(cart);
}

export async function clearCart(sessionId: string): Promise<void> {
  await redis.del(cacheKeys.cart(sessionId));
}

export function cartSubtotal(cart: Cart): number {
  return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
