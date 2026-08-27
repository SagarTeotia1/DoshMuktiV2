export type OfferBehavior = 'DISPLAY_ONLY' | 'AUTO_APPLIED' | 'COUPON_BASED';

export type OfferReward =
  | 'DISPLAY_MESSAGE'
  | 'PERCENTAGE_DISCOUNT'
  | 'FLAT_DISCOUNT'
  | 'CASHBACK'
  | 'FREE_GIFT'
  | 'BUY_X_GET_Y'
  | 'FREE_SHIPPING';

export interface DisplayMessageConfig {
  bannerText: string;
}

export interface PercentageDiscountConfig {
  percent: number; // 0-100
  maxDiscount?: number;
}

export interface FlatDiscountConfig {
  amount: number;
}

export interface CashbackConfig {
  percent: number; // 0-100
}

export interface FreeGiftConfig {
  productId: string;
}

export interface BuyXGetYConfig {
  buyQuantity: number;
  getQuantity: number;
  getProductId?: string;
}

export interface FreeShippingConfig {
  minOrderValue?: number;
}

// Maps each reward literal to its config shape — the single source of truth
// for "what fields does this reward's config carry."
export interface OfferConfigMap {
  DISPLAY_MESSAGE: DisplayMessageConfig;
  PERCENTAGE_DISCOUNT: PercentageDiscountConfig;
  FLAT_DISCOUNT: FlatDiscountConfig;
  CASHBACK: CashbackConfig;
  FREE_GIFT: FreeGiftConfig;
  BUY_X_GET_Y: BuyXGetYConfig;
  FREE_SHIPPING: FreeShippingConfig;
}

export type OfferConfig = OfferConfigMap[OfferReward];

export type OfferScope = 'SPECIFIC_PRODUCTS' | 'CATEGORY' | 'ALL_PRODUCTS';

interface OfferBase {
  id: string;
  title: string;
  behavior: OfferBehavior;
  couponId: string | null;
  coupon: { id: string; code: string } | null;
  isActive: boolean;
  scope: OfferScope;
  category: string | null; // set only when scope === 'CATEGORY'
  // Scope-aware server-side: for SPECIFIC_PRODUCTS it's "products explicitly linked",
  // for CATEGORY it's "active products currently in `category`", for ALL_PRODUCTS
  // it's "active products total". Just display it — formatting hints at scope.
  productCount: number;
  // The actual linked product ids — only ever non-empty when scope === 'SPECIFIC_PRODUCTS'.
  // Used to seed the offer-edit form's product picker directly, instead of inferring it by
  // cross-referencing a paginated product list (which silently drops links once the
  // catalog exceeds one page).
  productIds: string[];
  // Spend-threshold condition — meaningful for DISPLAY_ONLY/AUTO_APPLIED behaviors
  // ("only applies once the cart reaches ₹X"). Always null for COUPON_BASED — the
  // linked Coupon has its own `minOrder` for that, and showing both would confuse.
  minOrderValue: number | null;
  createdAt: string;
  updatedAt: string;
}

// Discriminated union on `reward` — `offer.config` narrows automatically
// inside a `switch (offer.reward)`/`if (offer.reward === '...')` block.
export type Offer = {
  [R in OfferReward]: OfferBase & { reward: R; config: OfferConfigMap[R] };
}[OfferReward];

export interface ProductImage {
  thumb: string;
  card: string;
  full: string;
}

export interface Banner {
  id: string;
  image: ProductImage;
  link: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedOffers {
  offers: Offer[];
  total: number;
  page: number;
  pageSize: number;
}

export type CouponType = 'FLAT' | 'PERCENT' | 'BIRTHDAY';

export interface Coupon {
  id: string;
  code: string; // stored/displayed uppercase
  type: CouponType;
  value: number; // ₹ for FLAT, % for PERCENT/BIRTHDAY
  minOrder: number | null;
  maxUses: number | null; // null = unlimited
  usedCount: number;
  maxDiscount: number | null; // cap, meaningful for PERCENT/BIRTHDAY
  expiresAt: string | null; // ISO date
  isActive: boolean;
  offerCount: number; // how many Offers (behavior=COUPON_BASED) link to this coupon
  createdAt: string;
}

export interface PaginatedCoupons {
  coupons: Coupon[];
  total: number;
  page: number;
  pageSize: number;
}

// Admin-composed, fully-ordered product description — any mix/count of text and
// image blocks, in the order the admin arranges them (not a fixed alternation).
// Mirrors Backend/src/modules/products/schema.ts's descriptionBlockSchema.
export type DescriptionBlock =
  | { type: 'text'; content: string }
  | { type: 'image'; thumb: string; card: string; full: string };

// One "Loved by X customers" PDP testimonial video card, admin-managed.
// Mirrors Backend/src/modules/products/schema.ts's testimonialVideoSchema.
export interface TestimonialVideo {
  id: string;
  videoUrl: string;
  posterUrl: string | null;
  caption: string;
  views: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  priceOverride: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  weight: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: DescriptionBlock[];
  category: string;
  basePrice: number;
  compareAtPrice: number | null;
  images: Array<{ thumb: string; card: string; full: string }>;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  purpose: string[];
  featured: boolean;
  badge: string | null;
  benefits: Array<{ title: string; description: string }>;
  howToWear: string[];
  careInstructions: string | null;
  socialProofText: string | null;
  tags: string[];
  cashbackPercent: number | null;
  howToUseVideoUrl: string | null;
  testimonialVideos: TestimonialVideo[];
  sidhiPrice: number | null;
  selfEnergizeInstructions: string | null;
  offers: Offer[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProducts {
  products: Product[];
  total: number;
  pages: number;
  page: number;
}

export interface OrderItem {
  id: string;
  variantId: string;
  quantity: number;
  priceAtPurchase: number;
  variantSnapshot: { sku: string; attributes: Record<string, string>; productName: string };
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
  status: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  items: OrderItem[];
  payment: { status: string; razorpayPaymentId: string | null } | null;
  shipment: { delhiveryWaybill: string | null; status: string } | null;
  statusLog?: Array<{ from: string; to: string; note: string | null; createdBy: string; createdAt: string }>;
  createdAt: string;
}

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  pages: number;
  page: number;
}

export interface DashboardSummary {
  todayOrderCount: number;
  todayRevenue: number;
  ordersNeedingAction: number;
  lowStockCount: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface InventoryProduct {
  id: string;
  name: string;
  variants: ProductVariant[];
}

export interface Review {
  id: string;
  productId: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  product: { name: string; slug: string };
}

export interface PaginatedReviews {
  reviews: Review[];
  total: number;
  pages: number;
  page: number;
}
