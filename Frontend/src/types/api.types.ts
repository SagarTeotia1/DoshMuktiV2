// Mirrors Backend/src/modules/*/schema.ts response shapes. Update both sides
// in the same commit — see docs/PATTERNS.md § "Why No Shared Package."
import { z } from 'zod';

// Admin-composed, fully-ordered product description — any mix/count of text and
// image blocks, in the order the admin arranges them (not a fixed alternation).
// Mirrors Backend/src/modules/products/schema.ts's descriptionBlockSchema.
export const descriptionBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('image'), thumb: z.string(), card: z.string(), full: z.string() }),
]);
export type DescriptionBlock = z.infer<typeof descriptionBlockSchema>;

// One "Loved by X customers" PDP testimonial video card, admin-managed.
// Mirrors Backend/src/modules/products/schema.ts's testimonialVideoSchema.
export const testimonialVideoSchema = z.object({
  id: z.string(),
  videoUrl: z.string(),
  posterUrl: z.string().nullable().optional(),
  caption: z.string(),
  views: z.string(),
});
export type TestimonialVideo = z.infer<typeof testimonialVideoSchema>;

// Mirrors Backend/src/modules/banners/schema.ts's response shape.
const bannerImageSchema = z.object({ thumb: z.string(), card: z.string(), full: z.string() });
export const bannerSchema = z.object({
  id: z.string(),
  image: bannerImageSchema,
  mobileImage: bannerImageSchema.nullable().optional(),
  link: z.string(),
  order: z.number(),
  isActive: z.boolean(),
});
export type Banner = z.infer<typeof bannerSchema>;

export const productVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  attributes: z.record(z.string()),
  priceOverride: z.number().nullable(),
  stockQuantity: z.number(),
  isActive: z.boolean(),
  // Grams — feeds the shipping-charge estimate shown on the PDP.
  weight: z.number().default(500),
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.array(descriptionBlockSchema).default([]),
  // Short plain-text teaser derived server-side from the first text block —
  // used for card excerpts/meta copy where a full block array can't render.
  excerpt: z.string().default(''),
  categories: z.array(z.string()),
  basePrice: z.number(),
  compareAtPrice: z.number().nullable(),
  images: z.array(z.object({ thumb: z.string(), card: z.string(), full: z.string() })),
  purpose: z.array(z.string()),
  featured: z.boolean(),
  badge: z.string().nullable(),
  benefits: z.array(z.object({ title: z.string(), description: z.string() })).default([]),
  howToWear: z.array(z.string()).default([]),
  careInstructions: z.string().nullable(),
  socialProofText: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  howToUseVideoUrl: z.string().nullable(),
  testimonialVideos: z.array(testimonialVideoSchema).default([]),
  sidhiPrice: z.number().nullable(),
  selfEnergizeInstructions: z.string().nullable(),
  offers: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        behavior: z.enum(['DISPLAY_ONLY', 'AUTO_APPLIED', 'COUPON_BASED']),
        reward: z.enum([
          'DISPLAY_MESSAGE',
          'PERCENTAGE_DISCOUNT',
          'FLAT_DISCOUNT',
          'FREE_GIFT',
          'BUY_X_GET_Y',
          'FREE_SHIPPING',
        ]),
        config: z.record(z.string(), z.unknown()),
        // Spend threshold — meaningful for DISPLAY_ONLY/AUTO_APPLIED, always null for
        // COUPON_BASED (that behavior's minimum-order condition lives on the coupon itself).
        minOrderValue: z.number().nullable(),
        // Only non-null when behavior === 'COUPON_BASED'.
        coupon: z.object({ code: z.string() }).nullable(),
      })
    )
    .default([]),
  rating: z.object({ average: z.number(), count: z.number() }).default({ average: 0, count: 0 }),
  variants: z.array(productVariantSchema),
  // Server-computed: admin override (if set) else basePrice >= RETURN_ELIGIBLE_ABOVE.
  returnEligible: z.boolean().default(false),
});
export type Product = z.infer<typeof productSchema>;

// Storefront-wide "Suggested Offers" widget — admin-curated (Offer.showInSuggestions),
// not tied to any one product page. Same offer shape as Product['offers'] above, since
// it's the same underlying Offer row, just fetched from a different endpoint.
// Mirrors Backend/src/modules/offers/service.ts's getSuggestedOffers.
export const suggestedOfferSchema = z.object({
  id: z.string(),
  title: z.string(),
  behavior: z.enum(['DISPLAY_ONLY', 'AUTO_APPLIED', 'COUPON_BASED']),
  reward: z.enum(['DISPLAY_MESSAGE', 'PERCENTAGE_DISCOUNT', 'FLAT_DISCOUNT', 'FREE_GIFT', 'BUY_X_GET_Y', 'FREE_SHIPPING']),
  config: z.record(z.string(), z.unknown()),
  minOrderValue: z.number().nullable(),
  coupon: z.object({ code: z.string() }).nullable(),
});
export type SuggestedOffer = z.infer<typeof suggestedOfferSchema>;

// Standalone coupon suggestions — a coupon can be surfaced here even with no linked
// Offer (e.g. a birthday code). Mirrors Backend's getSuggestedCoupons.
export const suggestedCouponSchema = z.object({
  id: z.string(),
  code: z.string(),
  type: z.enum(['FLAT', 'PERCENT', 'BIRTHDAY']),
  value: z.number(),
  minOrder: z.number().nullable(),
  maxDiscount: z.number().nullable(),
  expiresAt: z.string().nullable(),
});
export type SuggestedCoupon = z.infer<typeof suggestedCouponSchema>;

export const paginatedProductsSchema = z.object({
  products: z.array(productSchema),
  total: z.number(),
  pages: z.number(),
  page: z.number(),
});
export type PaginatedProducts = z.infer<typeof paginatedProductsSchema>;

// Mirrors Backend/src/modules/homepage-sections/schema.ts's response shape.
// Admin-managed, ordered homepage product rails — replaces the hardcoded
// "Handpicked This Week" / "Doshmukti Special" / "Rudraksha" / "Bracelets" rails.
export const homepageSectionSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  order: z.number(),
  products: z.array(productSchema),
});
export type HomepageSection = z.infer<typeof homepageSectionSchema>;

export interface CartItem {
  variantId: string;
  quantity: number;
  price: number;
  maxStock: number;
  productName: string;
  sku: string;
  imageUrl: string | null;
  gstRate?: number | null;
  // Grams — used to recompute a real shipping rate once checkout has a destination pincode.
  weight?: number;
  // MRP ("strikethrough" price) — feeds the "You saved ₹X" line. Null/absent = no MRP set.
  compareAtPrice?: number | null;
}

export interface CartResponse {
  sessionId: string;
  items: CartItem[];
  subtotal: number;
  // Backend-computed pricing preview — same resolution path checkout itself uses, so this
  // can never drift from what actually gets charged. Discount from AUTO_APPLIED offers
  // (percent/flat/free-gift, not tied to a coupon code) — coupon discount is separate,
  // applied client-side on top of this via the checkout page's own coupon-preview call.
  autoAppliedDiscount: number;
  // Full details of any auto-applied free gift(s) — enough to render an actual
  // "🎁 Attar (3ml) x1 — FREE" line, not just a count.
  freeItems: Array<{ variantId: string; productName: string; sku: string; quantity: number; weight: number }>;
  shippingFee: number;
  // The real (or flat-fallback) shipping cost regardless of whether it's actually being
  // charged — lets the UI show "₹99 → FREE" once the cart crosses the free-shipping
  // threshold instead of the fee just disappearing. Equal to shippingFee otherwise.
  shippingFeeOriginal: number;
  total: number;
  // Inclusive GST breakup of `subtotal` — taxableValue + gstAmount === subtotal. gstAmount
  // is 0 when no cart item carries a gstRate, so the UI can hide the GST line entirely.
  taxableValue: number;
  gstAmount: number;
  // Sum of (compareAtPrice - price) × quantity across every line with an MRP above its
  // actual price — server-computed so cart and checkout never show different numbers.
  savings: number;
  updatedAt: string;
}

export interface Address {
  id: string;
  receiverPhone: string;
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface AddressInput {
  name: string;
  receiverPhone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  setDefault?: boolean;
}

export interface CheckoutInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country?: string };
  items: Array<{ variantId: string; quantity: number }>;
  couponCode?: string;
}

export type CouponErrorCode =
  | 'COUPON_NOT_FOUND'
  | 'COUPON_INACTIVE'
  | 'COUPON_EXPIRED'
  | 'COUPON_USAGE_LIMIT'
  | 'COUPON_MIN_ORDER'
  | 'COUPON_BIRTHDAY_INELIGIBLE'
  | 'COUPON_EXHAUSTED';

export type CouponPreviewResponse =
  | { valid: true; discountAmount: number }
  | { valid: false; error: string; code: CouponErrorCode };

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  // SmartGateway's hosted payment page — full-page redirect, no client-side SDK.
  paymentLink: string;
  amount: number;
  currency: string;
}

export interface OrderTrackingResponse {
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  total: number;
  // Inclusive GST breakup of the items' line totals — same formula as the invoice PDF.
  // gstAmount is 0 when no item on the order carries a gstRate.
  taxableValue: number;
  gstAmount: number;
  items: Array<{
    variantSnapshot: { productName: string; sku: string; attributes?: Record<string, unknown> };
    quantity: number;
    priceAtPurchase: number;
    // Present on every order-read endpoint (track/mine) — the variant's live product
    // record, joined in purely to source a thumbnail. Not point-in-time like
    // variantSnapshot: if the product's images change later, so does this thumbnail.
    variant?: { product?: { images?: Array<{ thumb: string; card: string; full: string }> } };
  }>;
  shipment: {
    delhiveryWaybill: string | null;
    status: string;
    estimatedDelivery: string | null;
    trackingEvents: Array<{ timestamp: string; status: string; location?: string; description?: string }>;
  } | null;
  // Mirrors the Backend's actual invoice-download gate exactly (payment.status === 'CAPTURED'
  // in Backend/src/modules/orders/controller.ts) — checking this instead of order.status keeps
  // the Frontend's "should we show the Download Invoice link" logic from ever drifting out of
  // sync with what the endpoint will actually allow (e.g. an admin manually moving an order's
  // status forward before payment is actually captured).
  payment: { status: string } | null;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country?: string };
  createdAt: string;
}

export interface Review {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
}

export interface ProductReviewsResponse {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRecommendedProduct {
  id: string;
  name: string;
  slug: string;
  thumb: string | null;
}

export interface ChatResponse {
  reply: string;
  recommendedProducts?: ChatRecommendedProduct[];
  recommendationReason?: string | null;
}

export interface CreateReviewInput {
  customerName: string;
  productId: string;
  rating: number;
  title?: string;
  body: string;
}
