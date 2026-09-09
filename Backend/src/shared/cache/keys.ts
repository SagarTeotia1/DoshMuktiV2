export const cacheKeys = {
  cart: (sessionId: string) => `cart:${sessionId}` as const,
  pincode: (pincode: string) => `pincode:serviceability:${pincode}` as const,
  productsListing: (params: string) => `products:listing:${params}` as const,
  productSlug: (slug: string) => `product:slug:${slug}` as const,
  featuredProducts: (limit: number) => `products:featured:${limit}` as const,
  productCategories: () => `products:categories` as const,
  categoryThumbnails: () => `products:category-thumbs` as const,
  cronLock: (job: string) => `cron:lock:${job}` as const,
  chatProfile: (sessionId: string) => `chat:profile:${sessionId}` as const,
  // Per-session daily cap — the per-IP burst limit in chat/routes.ts stops rapid-fire
  // spam but not a single determined user grinding away steadily over hours (or behind
  // a shared/rotating IP), which is what actually runs up the LLM bill over a day.
  chatDailyCount: (sessionId: string) => `chat:daily-count:${sessionId}` as const,
  activeBanners: () => `banners:active` as const,
  activeHomepageSections: () => `homepage:sections:active` as const,
  // originPincode|destPincode|weightGrams — same route+weight always prices the same,
  // so this is safe to cache and saves a live Delhivery call on every cart/PDP view.
  shippingRate: (originPincode: string, destPincode: string, weightGrams: number) =>
    `shipping:rate:${originPincode}:${destPincode}:${weightGrams}` as const,
} as const;

export const CACHE_TTL = {
  CART: 60 * 60 * 24 * 7,
  PINCODE: 60 * 60 * 48,
  PRODUCTS_LIST: 60 * 5,
  PRODUCT_DETAIL: 60 * 30,
  FEATURED: 60 * 10,
  CATEGORIES: 60 * 15,
  CATEGORY_THUMBS: 60 * 15,
  CRON_LOCK: 60,
  CHAT_PROFILE: 60 * 60 * 24 * 30,
  CHAT_DAILY_LIMIT: 60 * 60 * 24,
  BANNERS: 60 * 10,
  HOMEPAGE_SECTIONS: 60 * 10,
  SHIPPING_RATE: 60 * 60, // 1h — rates don't move minute to minute, and this is hit on every cart/PDP view
} as const;
