import type { Coupon, OfferReward, Offer, Prisma } from "@prisma/client";
import { db } from "../../shared/db/client";
import { attachApplicableOffers } from "../offers/service";
import { processReward } from "../offers/rewards/registry";
import type { CheckoutLineItem } from "../offers/service";
import type {
  CreateCouponInput,
  ListCouponsQuery,
  PreviewCouponInput,
  UpdateCouponInput,
} from "./schema";

// ─── Errors ─────────────────────────────────────────────────────────────────

// Thrown by createCoupon on a unique-constraint violation on `code` (P2002) — a
// clear, named error instead of letting the raw Prisma error leak to the controller.
export class CouponCodeTakenError extends Error {
  constructor(public code: string) {
    super(`Coupon code already exists: ${code}`);
    this.name = "CouponCodeTakenError";
  }
}

// Reused for both "no coupon with this code" (findValidatedCoupon, code-based lookup)
// and "no coupon with this id" (updateCoupon) — same failure, just a different
// identifier in the message. `identifier` carries whichever was looked up.
export class CouponNotFoundError extends Error {
  constructor(public identifier: string) {
    super(`Coupon not found: ${identifier}`);
    this.name = "CouponNotFoundError";
  }
}

export class CouponInactiveError extends Error {
  constructor(public code: string) {
    super(`Coupon is no longer active: ${code}`);
    this.name = "CouponInactiveError";
  }
}

export class CouponExpiredError extends Error {
  constructor(public code: string) {
    super(`Coupon has expired: ${code}`);
    this.name = "CouponExpiredError";
  }
}

export class CouponUsageLimitReachedError extends Error {
  constructor(public code: string) {
    super(`Coupon usage limit reached: ${code}`);
    this.name = "CouponUsageLimitReachedError";
  }
}

export class CouponMinOrderNotMetError extends Error {
  constructor(
    public code: string,
    public minOrder: number,
  ) {
    super(`Minimum order of ${minOrder} not met for coupon: ${code}`);
    this.name = "CouponMinOrderNotMetError";
  }
}

export class CouponBirthdayNotEligibleError extends Error {
  constructor(public code: string) {
    super(`Coupon is only valid on the customer's birthday: ${code}`);
    this.name = "CouponBirthdayNotEligibleError";
  }
}

// Thrown inside the checkout transaction when reserveCouponUsageTx loses the race for
// the last usage slot — the pre-transaction findValidatedCoupon check passed, but a
// concurrent checkout consumed the last slot first. Same tier as OutOfStockError.
export class CouponExhaustedError extends Error {
  constructor(public couponId: string) {
    super(`Coupon usage limit reached during checkout: ${couponId}`);
    this.name = "CouponExhaustedError";
  }
}

// Preview-only: one or more of the requested variantIds don't resolve to a real,
// active variant. Not one of the six named coupon-validation errors, but the preview
// handler still degrades it to { valid: false } rather than a hard 400 — see controller.ts.
export class CouponPreviewItemsInvalidError extends Error {
  constructor(public variantId: string) {
    super(`Invalid or unavailable item: ${variantId}`);
    this.name = "CouponPreviewItemsInvalidError";
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

export class InvalidCouponValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCouponValueError";
  }
}

// PERCENT/BIRTHDAY value is a 0-100 percentage; FLAT is an unbounded ₹ amount. The Zod
// schema can only enforce this on a full create payload (type is always present there) —
// a PATCH might send `value` without resending `type`, so this is checked here against the
// merged (existing + incoming) type/value on every create AND update. Without this, a
// PERCENT coupon with e.g. value:150 and no linked offer falls through to
// computeFallbackCouponDiscount's percent math and can produce a discount larger than the
// subtotal — a negative order total that breaks checkout downstream.
function assertValidCouponValue(
  type: "FLAT" | "PERCENT" | "BIRTHDAY",
  value: number,
) {
  if (type !== "FLAT" && value > 100) {
    throw new InvalidCouponValueError("Percent value must be 100 or less");
  }
}

// ─── Admin CRUD ─────────────────────────────────────────────────────────────

const withCountInclude = {
  _count: { select: { offers: true } },
} satisfies Prisma.CouponInclude;

// offerCount is a live count of Offer rows linked to this coupon (behavior is always
// COUPON_BASED for any offer with a couponId set — enforced at the offers/schema.ts
// boundary). A coupon with 0 linked offers is still valid: resolveCouponRewardsForCheckout
// falls back to computing the discount straight from the coupon's own type/value/maxDiscount.
function withOfferCount<T extends { _count: { offers: number } }>(coupon: T) {
  const { _count, ...rest } = coupon;
  return { ...rest, offerCount: _count.offers };
}

export async function listCoupons(query: ListCouponsQuery) {
  const where: Prisma.CouponWhereInput = {
    ...(query.search
      ? { code: { contains: query.search, mode: "insensitive" as const } }
      : {}),
    ...(query.status ? { isActive: query.status === "active" } : {}),
  };

  const [coupons, total] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: withCountInclude,
    }),
    db.coupon.count({ where }),
  ]);

  return {
    coupons: coupons.map(withOfferCount),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getCouponById(id: string) {
  const coupon = await db.coupon.findUnique({
    where: { id },
    include: withCountInclude,
  });
  if (!coupon) return null;
  return withOfferCount(coupon);
}

export async function createCoupon(input: CreateCouponInput) {
  assertValidCouponValue(input.type, input.value);
  try {
    const created = await db.coupon.create({
      data: {
        code: input.code,
        type: input.type,
        value: input.value,
        minOrder: input.minOrder ?? null,
        maxUses: input.maxUses ?? null,
        maxDiscount: input.maxDiscount ?? null,
        expiresAt: input.expiresAt ?? null,
      },
      include: withCountInclude,
    });
    return withOfferCount(created);
  } catch (err) {
    if (isUniqueConstraintError(err))
      throw new CouponCodeTakenError(input.code);
    throw err;
  }
}

export async function updateCoupon(id: string, input: UpdateCouponInput) {
  const existing = await db.coupon.findUnique({ where: { id } });
  if (!existing) throw new CouponNotFoundError(id);

  assertValidCouponValue(
    input.type ?? existing.type,
    input.value ?? Number(existing.value),
  );

  try {
    const updated = await db.coupon.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.minOrder !== undefined ? { minOrder: input.minOrder } : {}),
        ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
        ...(input.maxDiscount !== undefined
          ? { maxDiscount: input.maxDiscount }
          : {}),
        ...(input.expiresAt !== undefined
          ? { expiresAt: input.expiresAt }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: withCountInclude,
    });
    return withOfferCount(updated);
  } catch (err) {
    if (isUniqueConstraintError(err))
      throw new CouponCodeTakenError(input.code ?? existing.code);
    throw err;
  }
}

// ─── Validation — single source of truth ───────────────────────────────────
//
// findValidatedCoupon is read-only (no mutation) and is the ONE place these checks
// live — both the public preview endpoint and checkout's initiateCheckout call this,
// nothing else re-implements any of these rules.

export async function findValidatedCoupon(input: {
  code: string;
  subtotal: number;
  customerDob?: Date;
}): Promise<Coupon> {
  const normalizedCode = input.code.trim().toUpperCase();

  const coupon = await db.coupon.findUnique({
    where: { code: normalizedCode },
  });
  if (!coupon) throw new CouponNotFoundError(normalizedCode);
  if (!coupon.isActive) throw new CouponInactiveError(normalizedCode);
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now())
    throw new CouponExpiredError(normalizedCode);
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new CouponUsageLimitReachedError(normalizedCode);
  }
  if (coupon.minOrder !== null && input.subtotal < Number(coupon.minOrder)) {
    throw new CouponMinOrderNotMetError(
      normalizedCode,
      Number(coupon.minOrder),
    );
  }
  if (coupon.type === "BIRTHDAY") {
    const today = new Date();
    const matchesToday =
      !!input.customerDob &&
      input.customerDob.getMonth() === today.getMonth() &&
      input.customerDob.getDate() === today.getDate();
    if (!matchesToday) throw new CouponBirthdayNotEligibleError(normalizedCode);
  }

  return coupon;
}

// ─── Checkout integration ───────────────────────────────────────────────────

export interface CouponRewardsResult {
  discountAmount: number;
  freeItems: Array<{ variantId: string; quantity: number }>;
}

// PERCENT and BIRTHDAY both use percentage math here — a BIRTHDAY coupon's eligibility
// is already gated by the DOB check in findValidatedCoupon, not by different discount
// math; there's no separate "birthday discount shape" in the schema to draw from.
function computeFallbackCouponDiscount(
  coupon: Coupon,
  subtotal: number,
): number {
  const value = Number(coupon.value);
  if (coupon.type === "FLAT") return Math.min(value, subtotal);
  const maxDiscount =
    coupon.maxDiscount !== null ? Number(coupon.maxDiscount) : Infinity;
  // Defense in depth: assertValidCouponValue already keeps `value` <= 100 for
  // PERCENT/BIRTHDAY at write time, but clamping to subtotal here too means a discount
  // can never exceed the order it's discounting, regardless of how the row got its value
  // (a pre-existing row from before this check existed, a direct DB edit, etc.) — a
  // negative order total is the failure mode that actually breaks checkout downstream.
  return Math.min((subtotal * value) / 100, maxDiscount, subtotal);
}

// Mirrors resolveAutoAppliedRewardsForCheckout's exact shape/semantics: first-matching
// discount-offer-per-item (no stacking), one free unit per matching FREE_GIFT offer per
// order — just scoped to COUPON_BASED offers linked to this one coupon instead of every
// AUTO_APPLIED offer. If the coupon has zero linked COUPON_BASED offers at all, falls
// back to computing the discount directly from the coupon's own fields against subtotal.
export async function resolveCouponRewardsForCheckout(
  items: CheckoutLineItem[],
  couponId: string,
): Promise<CouponRewardsResult> {
  if (items.length === 0) return { discountAmount: 0, freeItems: [] };

  const linkedOfferCount = await db.offer.count({
    where: { couponId, behavior: "COUPON_BASED" },
  });

  if (linkedOfferCount === 0) {
    const coupon = await db.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) return { discountAmount: 0, freeItems: [] };
    const subtotal = items.reduce((sum, item) => sum + item.itemSubtotal, 0);
    return {
      discountAmount: computeFallbackCouponDiscount(coupon, subtotal),
      freeItems: [],
    };
  }

  const uniqueProducts = new Map<string, { id: string; category: string }>();
  for (const item of items)
    uniqueProducts.set(item.productId, {
      id: item.productId,
      category: item.category,
    });

  const offersByProduct = await attachApplicableOffers(
    [...uniqueProducts.values()],
    {
      behaviorIn: ["COUPON_BASED"],
      couponId,
    },
  );

  const isDiscount = (reward: OfferReward) =>
    reward === "PERCENTAGE_DISCOUNT" || reward === "FLAT_DISCOUNT";

  let discountAmount = 0;
  for (const item of items) {
    const offer = (offersByProduct.get(item.productId) ?? []).find((o) =>
      isDiscount(o.reward),
    );
    if (!offer) continue;
    const result = await processReward(offer, {
      productId: item.productId,
      itemSubtotal: item.itemSubtotal,
    });
    discountAmount += result.discountAmount ?? 0;
  }

  const freeGiftOffers = new Map<string, Offer>();
  for (const offers of offersByProduct.values()) {
    for (const offer of offers) {
      if (offer.reward === "FREE_GIFT") freeGiftOffers.set(offer.id, offer);
    }
  }

  const freeItems: Array<{ variantId: string; quantity: number }> = [];
  for (const offer of freeGiftOffers.values()) {
    const result = await processReward(offer, {});
    if (result.freeItems) freeItems.push(...result.freeItems);
  }

  return { discountAmount, freeItems };
}

// Atomic guard — same pattern as checkout's reserveStock: UPDATE ... WHERE, checked by
// row count, never findFirst-then-update. This is the REAL usage-limit guard; the
// pre-transaction check in findValidatedCoupon can race under concurrent checkouts for
// the last usage slot, so this one runs inside the checkout transaction.
export async function reserveCouponUsageTx(
  tx: Prisma.TransactionClient,
  couponId: string,
): Promise<boolean> {
  const updated: number = await tx.$executeRaw`
    UPDATE "Coupon"
    SET "usedCount" = "usedCount" + 1
    WHERE id = ${couponId} AND "isActive" = true AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
  `;
  return updated === 1;
}

// Atomic decrement, floored at 0 — used by the release-holds job when an order that
// consumed a coupon slot expires unpaid, so an abandoned checkout doesn't permanently
// burn a limited-use coupon.
export async function releaseCouponUsageTx(
  tx: Prisma.TransactionClient,
  couponId: string,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE id = ${couponId}
  `;
}

// ─── Preview ─────────────────────────────────────────────────────────────────

// Resolves { variantId, quantity } pairs into the same CheckoutLineItem shape checkout
// builds from its own cart items, so resolveCouponRewardsForCheckout runs identically
// for both callers. Mirrors checkout/service.ts's variant lookup exactly (isActive
// variants only, priceOverride-or-basePrice pricing).
export async function resolveLineItemsForPreview(
  items: PreviewCouponInput["items"],
): Promise<{ lineItems: CheckoutLineItem[]; subtotal: number }> {
  const variantIds = items.map((i) => i.variantId);
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds }, isActive: true },
    include: { product: { select: { basePrice: true, category: true } } },
  });
  if (variants.length !== items.length) {
    const missing = variantIds.find(
      (id) => !variants.find((v) => v.id === id),
    )!;
    throw new CouponPreviewItemsInvalidError(missing);
  }

  const lineItems: CheckoutLineItem[] = items.map((item) => {
    const v = variants.find((x) => x.id === item.variantId)!;
    return {
      variantId: item.variantId,
      productId: v.productId,
      category: v.product.category,
      quantity: item.quantity,
      itemSubtotal:
        Number(v.priceOverride ?? v.product.basePrice) * item.quantity,
    };
  });
  const subtotal = lineItems.reduce((sum, li) => sum + li.itemSubtotal, 0);
  return { lineItems, subtotal };
}
