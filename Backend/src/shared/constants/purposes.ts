// Single source of truth on the Backend side. Mirrored in
// Frontend/src/lib/constants.ts — update both when this list changes.
export const PURPOSE_IDS = ['love', 'wealth', 'health', 'success', 'protection', 'clarity'] as const;
export type PurposeId = (typeof PURPOSE_IDS)[number];

export const PRODUCT_SORTS = ['newest', 'popular', 'price_asc', 'price_desc'] as const;
export type SortId = (typeof PRODUCT_SORTS)[number];

export const SHIPPING_FEE = 99;
export const FREE_SHIPPING_ABOVE = 999;
export const RESERVATION_MINUTES = 15;
export const PRODUCTS_PER_PAGE = 12;
