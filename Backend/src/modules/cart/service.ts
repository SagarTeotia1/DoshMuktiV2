import { db } from "../../shared/db/client";
import { redis } from "../../shared/cache/client";
import { cacheKeys, CACHE_TTL } from "../../shared/cache/keys";
import { resolveAutoAppliedRewardsForCheckout } from "../offers/service";
import type { CheckoutLineItem } from "../offers/service";
import { calculateShippingFee } from "../checkout/service";
import type { Cart, CartItem } from "./schema";

export class VariantNotFoundError extends Error {
  constructor(public variantId: string) {
    super(`Variant not found: ${variantId}`);
    this.name = "VariantNotFoundError";
  }
}

// Product.images is stored as Json ([{thumb,card,full}]) — see prisma/schema.prisma.
// Cart/free-gift lines only ever need the thumb-sized crop.
function firstThumb(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as { thumb?: unknown } | undefined;
  return typeof first?.thumb === "string" ? first.thumb : null;
}

export async function getCart(sessionId: string): Promise<Cart> {
  const cached = await redis.get<Cart>(cacheKeys.cart(sessionId));
  if (!cached) return { sessionId, items: [], updatedAt: new Date().toISOString() };

  // Carts persist in Redis across deploys — a session created before `imageUrl` or
  // `gstRate` was added to CartItem still has that field missing/undefined in its
  // cached JSON, so it silently falls back to the frontend's initials placeholder (or
  // drops out of the GST breakdown) forever, since the 7-day TTL is long enough to
  // outlive most sessions and the item is never re-added. Backfill both here instead of
  // making the customer clear and re-add their cart.
  const staleIds = cached.items
    .filter((i) => i.imageUrl === undefined || i.gstRate === undefined)
    .map((i) => i.variantId);
  if (staleIds.length === 0) return cached;

  const variants = await db.productVariant.findMany({
    where: { id: { in: staleIds } },
    include: { product: { select: { images: true, gstRate: true } } },
  });
  cached.items = cached.items.map((item) => {
    if (item.imageUrl !== undefined && item.gstRate !== undefined) return item;
    const v = variants.find((x) => x.id === item.variantId);
    return {
      ...item,
      imageUrl: item.imageUrl !== undefined ? item.imageUrl : v ? firstThumb(v.product.images) : null,
      gstRate:
        item.gstRate !== undefined ? item.gstRate : v && v.product.gstRate !== null ? Number(v.product.gstRate) : null,
    };
  });
  return saveCart(cached);
}

async function saveCart(cart: Cart): Promise<Cart> {
  cart.updatedAt = new Date().toISOString();
  await redis.set(cacheKeys.cart(cart.sessionId), cart, { ex: CACHE_TTL.CART });
  return cart;
}

export async function addItemToCart(
  sessionId: string,
  input: { variantId: string; quantity: number },
): Promise<Cart> {
  const variant = await db.productVariant.findFirst({
    where: { id: input.variantId, isActive: true },
    include: { product: { select: { name: true, basePrice: true, images: true, gstRate: true } } },
  });
  if (!variant) throw new VariantNotFoundError(input.variantId);

  const cart = await getCart(sessionId);
  const price = Number(variant.priceOverride ?? variant.product.basePrice);
  const existingIndex = cart.items.findIndex(
    (i) => i.variantId === input.variantId,
  );

  const item: CartItem = {
    variantId: input.variantId,
    quantity: input.quantity,
    price,
    maxStock: variant.stockQuantity,
    productName: variant.product.name,
    sku: variant.sku,
    imageUrl: firstThumb(variant.product.images),
    gstRate: variant.product.gstRate !== null ? Number(variant.product.gstRate) : null,
  };

  if (existingIndex >= 0) {
    const existing = cart.items[existingIndex]!;
    cart.items[existingIndex] = {
      ...item,
      quantity: Math.min(
        existing.quantity + input.quantity,
        variant.stockQuantity,
      ),
    };
  } else {
    cart.items.push({
      ...item,
      quantity: Math.min(input.quantity, variant.stockQuantity),
    });
  }

  return saveCart(cart);
}

export async function updateItemQuantity(
  sessionId: string,
  variantId: string,
  quantity: number,
): Promise<Cart> {
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

export async function removeItemFromCart(
  sessionId: string,
  variantId: string,
): Promise<Cart> {
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

export interface CartFreeItem {
  variantId: string;
  productName: string;
  sku: string;
  quantity: number;
}

export interface CartPricing {
  subtotal: number;
  autoAppliedDiscount: number;
  // Full details, not just a count — the cart/checkout pages need this to render an
  // actual "🎁 Attar (3ml) x1 — FREE" line, not just a number, so a customer can see
  // what they're getting before they ever reach the final order confirmation.
  freeItems: CartFreeItem[];
  shippingFee: number;
  total: number;
  // GST is an inclusive breakup of `subtotal` above, never an added charge — taxableValue
  // + gstAmount always sum back to subtotal. Same math as orders/invoice.ts, so the
  // pre-purchase preview here can never disagree with what the invoice shows after payment.
  // Omitted (both 0) when no cart item has a gstRate set, so the UI can hide the line
  // entirely rather than show a misleading "GST: Rs. 0.00".
  taxableValue: number;
  gstAmount: number;
}

function computeItemGst(lineTotal: number, gstRate: number): { taxableValue: number; gstAmount: number } {
  const taxableValue = lineTotal / (1 + gstRate / 100);
  return { taxableValue, gstAmount: lineTotal - taxableValue };
}

function computeCartGst(cart: Cart): { taxableValue: number; gstAmount: number } {
  let taxableValue = 0;
  let gstAmount = 0;
  for (const item of cart.items) {
    const lineTotal = item.price * item.quantity;
    if (typeof item.gstRate === 'number') {
      const breakup = computeItemGst(lineTotal, item.gstRate);
      taxableValue += breakup.taxableValue;
      gstAmount += breakup.gstAmount;
    } else {
      taxableValue += lineTotal;
    }
  }
  return { taxableValue, gstAmount };
}

// The cart/checkout pages previously computed their displayed total client-side as just
// `subtotal + shippingFee - walletRedeem`, never accounting for AUTO_APPLIED offer
// discounts (percent/flat/free-gift offers not tied to a coupon) — the actual Razorpay
// charge was always correct (checkout computes its own total server-side), but the
// customer never saw the price move before paying. This reuses the exact same
// resolveAutoAppliedRewardsForCheckout checkout itself calls, so the preview here can
// never drift from what checkout will actually charge — one source of truth, not a
// second reimplementation of the discount math.
export async function computeCartPricing(cart: Cart): Promise<CartPricing> {
  const subtotal = cartSubtotal(cart);
  const shippingFee = calculateShippingFee(subtotal);

  if (cart.items.length === 0) {
    return {
      subtotal,
      autoAppliedDiscount: 0,
      freeItems: [],
      shippingFee,
      total: subtotal + shippingFee,
      taxableValue: 0,
      gstAmount: 0,
    };
  }

  // isActive: true matches checkout's own variant fetch — a deactivated-but-not-deleted
  // variant should drop out of discount/minOrderValue resolution the same way checkout
  // would treat it, not silently keep contributing to eligibility from a stale cart entry.
  const variants = await db.productVariant.findMany({
    where: { id: { in: cart.items.map((i) => i.variantId) }, isActive: true },
    include: { product: { select: { categories: true } } },
  });

  // A cart item can point at a variant that's since gone inactive/deleted (Redis-cached,
  // not re-validated on every read) — skip pricing for it rather than throwing; the
  // add/update endpoints already guard against adding an invalid variant in the first
  // place, so this is just defensive for an item that went stale after being added.
  const lineItems: CheckoutLineItem[] = cart.items.flatMap((item) => {
    const v = variants.find((x) => x.id === item.variantId);
    if (!v) return [];
    return [
      {
        variantId: item.variantId,
        productId: v.productId,
        categories: v.product.categories,
        quantity: item.quantity,
        itemSubtotal: item.price * item.quantity,
      },
    ];
  });

  const { totalDiscount, freeItems } =
    await resolveAutoAppliedRewardsForCheckout(lineItems);

  // Free-gift variants are resolved from the offer's configured gift product, not from
  // anything already in the cart — a separate lookup, not reusable from the `variants`
  // query above (which only covers the customer's own cart items).
  const freeItemDetails: CartFreeItem[] =
    freeItems.length === 0
      ? []
      : await db.productVariant
          .findMany({
            where: { id: { in: freeItems.map((f) => f.variantId) } },
            include: { product: { select: { name: true } } },
          })
          .then((giftVariants) =>
            freeItems.flatMap((f) => {
              const v = giftVariants.find((x) => x.id === f.variantId);
              if (!v) return [];
              return [{ variantId: f.variantId, productName: v.product.name, sku: v.sku, quantity: f.quantity }];
            })
          );

  const { taxableValue, gstAmount } = computeCartGst(cart);

  return {
    subtotal,
    autoAppliedDiscount: totalDiscount,
    freeItems: freeItemDetails,
    shippingFee,
    // Clamped for display only — a defensive floor so a customer is never shown a
    // negative price, regardless of how a discount got computed.
    total: Math.max(subtotal + shippingFee - totalDiscount, 0),
    taxableValue,
    gstAmount,
  };
}
