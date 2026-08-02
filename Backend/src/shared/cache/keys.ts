export const cacheKeys = {
  cart: (sessionId: string) => `cart:${sessionId}` as const,
  pincode: (pincode: string) => `pincode:serviceability:${pincode}` as const,
  productsListing: (params: string) => `products:listing:${params}` as const,
  productSlug: (slug: string) => `product:slug:${slug}` as const,
  featuredProducts: (limit: number) => `products:featured:${limit}` as const,
  productCategories: () => `products:categories` as const,
  cronLock: (job: string) => `cron:lock:${job}` as const,
} as const;

export const CACHE_TTL = {
  CART: 60 * 60 * 24 * 7,
  PINCODE: 60 * 60 * 48,
  PRODUCTS_LIST: 60 * 5,
  PRODUCT_DETAIL: 60 * 30,
  FEATURED: 60 * 10,
  CATEGORIES: 60 * 15,
  CRON_LOCK: 60,
} as const;
