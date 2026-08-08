import type { Offer, OfferBehavior, OfferReward, OfferScope, Prisma } from '@prisma/client';
import { db } from '../../shared/db/client';
import { invalidateProductCaches } from '../products/service';
import { getConfigSchema, processReward } from './rewards/registry';
import type { CreateOfferInput, ListOffersQuery, UpdateOfferInput } from './schema';

export class OfferNotFoundError extends Error {
  constructor(public id: string) {
    super(`Offer not found: ${id}`);
    this.name = 'OfferNotFoundError';
  }
}

export class CouponNotFoundError extends Error {
  constructor(public couponId: string) {
    super(`Coupon not found: ${couponId}`);
    this.name = 'CouponNotFoundError';
  }
}

export class CategoryNotFoundError extends Error {
  constructor(public category: string) {
    super(`No product found in category: ${category}`);
    this.name = 'CategoryNotFoundError';
  }
}

export class InvalidOfferScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOfferScopeError';
  }
}

export class InvalidRewardConfigError extends Error {
  constructor(public issues: Array<{ path: (string | number)[]; message: string }>) {
    super('Invalid config for the selected reward');
    this.name = 'InvalidRewardConfigError';
  }
}

function assertValidConfig(reward: OfferReward, config: unknown) {
  const schema = getConfigSchema(reward);
  const result = schema.safeParse(config);
  if (!result.success) {
    throw new InvalidRewardConfigError(result.error.issues.map((i) => ({ path: i.path, message: i.message })));
  }
}

async function assertCouponExists(couponId: string) {
  const coupon = await db.coupon.findUnique({ where: { id: couponId }, select: { id: true } });
  if (!coupon) throw new CouponNotFoundError(couponId);
}

// Same "is this a real category" check the admin offers list needs — reuses the plain
// distinct-category existence semantics of getDistinctCategoriesForAdmin (no status
// filter, so a CATEGORY offer can be attached to a DRAFT-only category too).
async function assertCategoryExists(category: string) {
  const product = await db.product.findFirst({ where: { category }, select: { id: true } });
  if (!product) throw new CategoryNotFoundError(category);
}

// `productIds` is the *actual* linked-product list (SPECIFIC_PRODUCTS only, [] otherwise) —
// distinct from `productCount`, which is a live match-count for CATEGORY/ALL_PRODUCTS too.
// Admin's offer-edit form needs the real IDs to seed its picker; deriving that by
// cross-referencing a paginated product list instead (capped at however many products a
// list endpoint returns per page) silently drops any link outside that page on save — the
// backend already has the exact list from this same query, so just return it.
function withProductCount<T extends { _count: { products: number }; products: { id: string }[]; scope: OfferScope }>(
  offer: T,
  productCount: number
) {
  const { _count, products, ...rest } = offer;
  return { ...rest, productCount, productIds: offer.scope === 'SPECIFIC_PRODUCTS' ? products.map((p) => p.id) : [] };
}

// productCount is a static link only for SPECIFIC_PRODUCTS (the M:N relation). CATEGORY
// and ALL_PRODUCTS have no such link, so their "count" is a live query reflecting
// whatever currently matches — computed here in as few queries as possible regardless
// of how many offers are in the batch (one groupBy for every CATEGORY offer's category,
// one count for every ALL_PRODUCTS offer, shared across the whole batch).
async function computeProductCounts(
  offers: Array<{ id: string; scope: OfferScope; category: string | null; _count: { products: number } }>
): Promise<Map<string, number>> {
  const categoriesNeeded = new Set<string>();
  let needsAllProductsCount = false;
  for (const o of offers) {
    if (o.scope === 'CATEGORY' && o.category) categoriesNeeded.add(o.category);
    if (o.scope === 'ALL_PRODUCTS') needsAllProductsCount = true;
  }

  const [categoryCounts, allProductsCount] = await Promise.all([
    categoriesNeeded.size > 0
      ? db.product.groupBy({
          by: ['category'],
          where: { category: { in: [...categoriesNeeded] }, status: 'ACTIVE' },
          _count: true,
        })
      : Promise.resolve([] as Array<{ category: string; _count: number }>),
    needsAllProductsCount ? db.product.count({ where: { status: 'ACTIVE' } }) : Promise.resolve(0),
  ]);
  const categoryCountByName = new Map(categoryCounts.map((c) => [c.category, c._count]));

  const result = new Map<string, number>();
  for (const o of offers) {
    if (o.scope === 'SPECIFIC_PRODUCTS') result.set(o.id, o._count.products);
    else if (o.scope === 'CATEGORY') result.set(o.id, o.category ? (categoryCountByName.get(o.category) ?? 0) : 0);
    else result.set(o.id, allProductsCount);
  }
  return result;
}

const listInclude = {
  _count: { select: { products: true } },
  // Only ever non-empty for SPECIFIC_PRODUCTS offers in practice (the other two scopes
  // never populate the relation), but selected unconditionally since it's cheap and this
  // include is shared by every list/get/create/update/duplicate response.
  products: { select: { id: true } },
  coupon: { select: { id: true, code: true } },
} satisfies Prisma.OfferInclude;

// ─── Scope resolution — the single source of truth every read path routes through ──
//
// getApplicableOffersForProduct(product, opts?) → OfferWithCoupon[]
//   Active offers where scope=ALL_PRODUCTS, OR scope=CATEGORY && category matches, OR
//   scope=SPECIFIC_PRODUCTS && product is linked. Optional server-side behavior/reward
//   filtering (checkout wants AUTO_APPLIED+non-CASHBACK, wallet wants CASHBACK, the
//   storefront wants everything active). Coupon relation is joined unconditionally (see
//   OfferWithCoupon below) so a COUPON_BASED offer carries its coupon's code.
//
// attachApplicableOffers(products, opts?) → Map<productId, OfferWithCoupon[]>
//   Bulk variant for list views — avoids N+1 queries. One query for all active
//   ALL_PRODUCTS/CATEGORY offers (small table, cheap to pull in full), one query for the
//   SPECIFIC_PRODUCTS relation scoped to just the given product ids, merged in memory.

// Storefront-facing offer reads (getApplicableOffersForProduct/attachApplicableOffers)
// join the linked coupon's code so the "Exclusive Offers" cards can render/copy a
// COUPON_BASED offer's actual code instead of a bare, unusable couponId. Joined
// unconditionally rather than behind an opt-in flag: Coupon is a small table keyed by
// an indexed PK, so the extra join is cheap, and both callers of these functions
// (checkout/wallet resolution included) tolerate an unused extra field just fine — not
// worth a second code path to shave one join off the checkout hot path.
export type OfferWithCoupon = Offer & { coupon: { code: string } | null };

export interface ApplicableOffersOptions {
  behaviorIn?: OfferBehavior[];
  excludeReward?: OfferReward[];
  // Storefront reads want isActive:true only (default). Admin product reads want an
  // admin editing a product to see every offer that would apply to it, archived ones
  // included — same M:N/category/all-products resolution, just without the isActive
  // filter — so this is a filter toggle rather than a second parallel implementation.
  includeInactive?: boolean;
  // Coupon-based checkout/preview resolution: restrict to offers linked to this one
  // coupon (couponId, not just behavior). Paired with behaviorIn: ['COUPON_BASED'] by
  // callers in practice, but kept as its own filter since couponId is what's selective.
  couponId?: string;
}

function scopeFilterWhere(opts?: ApplicableOffersOptions): Prisma.OfferWhereInput {
  return {
    ...(opts?.includeInactive ? {} : { isActive: true }),
    ...(opts?.behaviorIn ? { behavior: { in: opts.behaviorIn } } : {}),
    ...(opts?.excludeReward ? { reward: { notIn: opts.excludeReward } } : {}),
    ...(opts?.couponId ? { couponId: opts.couponId } : {}),
  };
}

export async function getApplicableOffersForProduct(
  product: { id: string; category: string },
  opts?: ApplicableOffersOptions
): Promise<OfferWithCoupon[]> {
  return db.offer.findMany({
    where: {
      ...scopeFilterWhere(opts),
      OR: [
        { scope: 'ALL_PRODUCTS' },
        { scope: 'CATEGORY', category: product.category },
        { scope: 'SPECIFIC_PRODUCTS', products: { some: { id: product.id } } },
      ],
    },
    include: { coupon: { select: { code: true } } },
  });
}

export async function attachApplicableOffers<T extends { id: string; category: string }>(
  products: T[],
  opts?: ApplicableOffersOptions
): Promise<Map<string, OfferWithCoupon[]>> {
  const result = new Map<string, OfferWithCoupon[]>();
  if (products.length === 0) return result;
  for (const p of products) result.set(p.id, []);

  const categories = [...new Set(products.map((p) => p.category))];
  const productIds = products.map((p) => p.id);

  const [broadOffers, specificOffers] = await Promise.all([
    db.offer.findMany({
      where: {
        ...scopeFilterWhere(opts),
        OR: [{ scope: 'ALL_PRODUCTS' }, { scope: 'CATEGORY', category: { in: categories } }],
      },
      include: { coupon: { select: { code: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.offer.findMany({
      where: { ...scopeFilterWhere(opts), scope: 'SPECIFIC_PRODUCTS', products: { some: { id: { in: productIds } } } },
      include: {
        products: { where: { id: { in: productIds } }, select: { id: true } },
        coupon: { select: { code: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const categoryOffers = broadOffers.filter((o) => o.scope === 'CATEGORY');
  const allProductsOffers = broadOffers.filter((o) => o.scope === 'ALL_PRODUCTS');

  // Order matters: checkout's resolveAutoAppliedRewardsForCheckout picks the FIRST
  // matching discount offer per product (deliberately no stacking). A merchant-targeted
  // SPECIFIC_PRODUCTS offer must win over a broader CATEGORY sale, which must in turn win
  // over a blanket ALL_PRODUCTS sale — otherwise a store-wide "10% off everything" would
  // silently shadow a deliberately-configured "₹200 off this product" every time, with no
  // way for an admin to express which one should actually apply. Ties within the same
  // scope tier fall back to createdAt asc (oldest offer wins), for determinism.
  for (const { products: linkedProducts, ...offer } of specificOffers) {
    for (const linked of linkedProducts) {
      result.get(linked.id)?.push(offer as OfferWithCoupon);
    }
  }
  for (const p of products) {
    const applicable = result.get(p.id)!;
    for (const o of categoryOffers) {
      if (o.category === p.category) applicable.push(o);
    }
    applicable.push(...allProductsOffers);
  }
  return result;
}

export async function listOffers(query: ListOffersQuery) {
  const where: Prisma.OfferWhereInput = {
    ...(query.search ? { title: { contains: query.search, mode: 'insensitive' as const } } : {}),
    ...(query.behavior ? { behavior: query.behavior } : {}),
    ...(query.reward ? { reward: query.reward } : {}),
    ...(query.status ? { isActive: query.status === 'active' } : {}),
  };

  const [offers, total] = await Promise.all([
    db.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: listInclude,
    }),
    db.offer.count({ where }),
  ]);

  const counts = await computeProductCounts(offers);
  return {
    offers: offers.map((o) => withProductCount(o, counts.get(o.id) ?? 0)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getOfferById(id: string) {
  const offer = await db.offer.findUnique({ where: { id }, include: listInclude });
  if (!offer) return null;
  const counts = await computeProductCounts([offer]);
  return withProductCount(offer, counts.get(offer.id) ?? 0);
}

export async function createOffer(input: CreateOfferInput) {
  assertValidConfig(input.reward, input.config);
  if (input.couponId) await assertCouponExists(input.couponId);
  if (input.scope === 'CATEGORY') {
    if (!input.category) throw new InvalidOfferScopeError('category is required when scope is CATEGORY');
    await assertCategoryExists(input.category);
  }

  const created = await db.offer.create({
    data: {
      title: input.title,
      behavior: input.behavior,
      reward: input.reward,
      config: input.config as Prisma.InputJsonValue,
      couponId: input.couponId ?? null,
      scope: input.scope,
      // category/productIds are only meaningful for their matching scope — never persist
      // a stray value for the "wrong" scope, see schema.ts's refine for the intake rule.
      category: input.scope === 'CATEGORY' ? (input.category ?? null) : null,
      minOrderValue: input.minOrderValue ?? null,
      products:
        input.scope === 'SPECIFIC_PRODUCTS' && input.productIds && input.productIds.length > 0
          ? { connect: input.productIds.map((id) => ({ id })) }
          : undefined,
    },
    include: listInclude,
  });
  await invalidateProductCaches();
  const counts = await computeProductCounts([created]);
  return withProductCount(created, counts.get(created.id) ?? 0);
}

// Offers are embedded in cached product reads (getProductBySlug/listProducts/etc.) —
// any mutation here must bust those caches too, or the storefront serves a stale copy.
// Partial updates are re-validated against the *merged* (existing + incoming) reward/
// config pair, since a request might only send one of the two.
export async function updateOffer(id: string, input: UpdateOfferInput) {
  const existing = await db.offer.findUnique({ where: { id } });
  if (!existing) throw new OfferNotFoundError(id);

  const mergedReward = input.reward ?? existing.reward;
  const mergedConfig = input.config ?? (existing.config as Record<string, unknown>);
  assertValidConfig(mergedReward, mergedConfig);

  const mergedCouponId = input.couponId !== undefined ? input.couponId : existing.couponId;
  if (mergedCouponId) await assertCouponExists(mergedCouponId);

  // scope/category merged the same way as reward/config above — a partial update that
  // only touches one of the pair is re-validated against the merged, persisted values.
  const mergedScope = input.scope ?? existing.scope;
  const mergedCategory = input.category !== undefined ? input.category : existing.category;
  if (mergedScope === 'CATEGORY') {
    if (!mergedCategory) throw new InvalidOfferScopeError('category is required when scope is CATEGORY');
    await assertCategoryExists(mergedCategory);
  }

  // schema.ts's refine only rejects productIds-with-wrong-scope when both fields are
  // present in the SAME request — a PATCH sending only { productIds } against an offer
  // whose *persisted* scope is CATEGORY/ALL_PRODUCTS would otherwise sail through schema
  // validation and then silently discard the productIds via the `set: []` below. Re-check
  // against the merged (existing + incoming) scope so it 400s instead of quietly no-op'ing.
  if (mergedScope !== 'SPECIFIC_PRODUCTS' && input.productIds && input.productIds.length > 0) {
    throw new InvalidOfferScopeError('productIds can only be set when scope is SPECIFIC_PRODUCTS');
  }

  // Scope no longer SPECIFIC_PRODUCTS → the products relation is meaningless, clear it
  // so it can't silently resurface if scope changes back later without the admin
  // re-picking anything. Still SPECIFIC_PRODUCTS and productIds provided → full replace,
  // same "set fully replaces" semantics as Product.updateProduct's offerIds.
  const productsUpdate: Prisma.OfferUpdateInput['products'] =
    mergedScope !== 'SPECIFIC_PRODUCTS'
      ? { set: [] }
      : input.productIds !== undefined
        ? { set: input.productIds.map((productId) => ({ id: productId })) }
        : undefined;

  const updated = await db.offer.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.behavior !== undefined ? { behavior: input.behavior } : {}),
      ...(input.reward !== undefined ? { reward: input.reward } : {}),
      ...(input.config !== undefined ? { config: input.config as Prisma.InputJsonValue } : {}),
      ...(input.couponId !== undefined ? { couponId: input.couponId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      // Always re-asserted, not conditional on input.category — enforces the "cleared
      // whenever scope isn't CATEGORY" invariant even on updates that never touch scope.
      category: mergedScope === 'CATEGORY' ? mergedCategory : null,
      ...(input.minOrderValue !== undefined ? { minOrderValue: input.minOrderValue } : {}),
      ...(productsUpdate ? { products: productsUpdate } : {}),
    },
    include: listInclude,
  });
  await invalidateProductCaches();
  const counts = await computeProductCounts([updated]);
  return withProductCount(updated, counts.get(updated.id) ?? 0);
}

// Clones an offer's reusable definition — never its product assignments, matching the
// "creating an offer should never assign products" rule. Starts isActive:false so an
// admin has to deliberately re-enable it before it can affect anything.
export async function duplicateOffer(id: string) {
  const existing = await db.offer.findUnique({ where: { id } });
  if (!existing) throw new OfferNotFoundError(id);

  const created = await db.offer.create({
    data: {
      title: `${existing.title} (Copy)`,
      behavior: existing.behavior,
      reward: existing.reward,
      config: existing.config as Prisma.InputJsonValue,
      couponId: existing.couponId,
      isActive: false,
      scope: existing.scope,
      category: existing.category,
      minOrderValue: existing.minOrderValue,
    },
    include: listInclude,
  });
  const counts = await computeProductCounts([created]);
  return withProductCount(created, counts.get(created.id) ?? 0);
}

// ─── Checkout integration ───────────────────────────────────────────────────

export interface CheckoutLineItem {
  variantId: string;
  productId: string;
  category: string;
  quantity: number;
  itemSubtotal: number; // price * quantity for this line item
}

export interface AutoAppliedRewardsResult {
  totalDiscount: number;
  freeItems: Array<{ variantId: string; quantity: number }>;
}

// Replaces the old inline DISCOUNT/FREE_ITEM loops in checkout/service.ts. CASHBACK is
// excluded — it stays wallet-only, resolved post-payment via wallet/service.ts. Preserves
// exact prior semantics: first-matching-discount-offer-per-item (no stacking across
// multiple discount offers on one product), one free unit per matching FREE_GIFT offer
// per order. Eligible-offer-per-item is now resolved through attachApplicableOffers
// (scope-aware: ALL_PRODUCTS/CATEGORY/SPECIFIC_PRODUCTS) instead of the old
// products-relation-only where-filter — everything downstream is unchanged.
//
// minOrderValue enforcement: computed once from the whole cart's subtotal (sum of every
// line's itemSubtotal, not just the item the offer would apply to — a spend threshold is
// an order-level condition), then any AUTO_APPLIED offer whose minOrderValue exceeds it
// is treated exactly like a non-match — same "skip if ineligible, no stacking" pattern as
// everything else here, never a thrown error. Applies to both the discount-offer path and
// the free-gift path. This function also backs cart/service.ts's computeCartPricing, so
// the threshold is enforced identically in the cart preview and the real checkout charge.
export async function resolveAutoAppliedRewardsForCheckout(items: CheckoutLineItem[]): Promise<AutoAppliedRewardsResult> {
  if (items.length === 0) return { totalDiscount: 0, freeItems: [] };

  const subtotal = items.reduce((sum, item) => sum + item.itemSubtotal, 0);
  const meetsMinOrderValue = (offer: OfferWithCoupon) =>
    offer.minOrderValue == null || subtotal >= Number(offer.minOrderValue);

  const uniqueProducts = new Map<string, { id: string; category: string }>();
  for (const item of items) uniqueProducts.set(item.productId, { id: item.productId, category: item.category });

  const offersByProduct = await attachApplicableOffers([...uniqueProducts.values()], {
    behaviorIn: ['AUTO_APPLIED'],
    excludeReward: ['CASHBACK'],
  });

  const isDiscount = (reward: OfferReward) => reward === 'PERCENTAGE_DISCOUNT' || reward === 'FLAT_DISCOUNT';

  let totalDiscount = 0;
  for (const item of items) {
    const offer = (offersByProduct.get(item.productId) ?? []).find((o) => isDiscount(o.reward) && meetsMinOrderValue(o));
    if (!offer) continue;
    const result = await processReward(offer, { productId: item.productId, itemSubtotal: item.itemSubtotal });
    totalDiscount += result.discountAmount ?? 0;
  }

  // Dedupe by offer id across products — a store-wide FREE_GIFT offer would otherwise
  // appear once per distinct product in the cart; prior behavior was one free unit per
  // matching offer per order, not per product.
  const freeGiftOffers = new Map<string, OfferWithCoupon>();
  for (const offers of offersByProduct.values()) {
    for (const offer of offers) {
      if (offer.reward === 'FREE_GIFT' && meetsMinOrderValue(offer)) freeGiftOffers.set(offer.id, offer);
    }
  }

  const freeItems: Array<{ variantId: string; quantity: number }> = [];
  for (const offer of freeGiftOffers.values()) {
    const result = await processReward(offer, {});
    if (result.freeItems) freeItems.push(...result.freeItems);
  }

  return { totalDiscount, freeItems };
}
