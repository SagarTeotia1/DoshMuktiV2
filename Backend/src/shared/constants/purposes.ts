// Single source of truth on the Backend side. Mirrored in
// Frontend/src/lib/constants.ts — update both when this list changes.
export const PURPOSE_IDS = ['love', 'wealth', 'health', 'success', 'protection', 'clarity', 'gifting'] as const;
export type PurposeId = (typeof PURPOSE_IDS)[number];

export const PRODUCT_SORTS = ['newest', 'popular', 'price_asc', 'price_desc'] as const;
export type SortId = (typeof PRODUCT_SORTS)[number];

export const SHIPPING_FEE = 99; // flat fallback only — used when Delhivery's live rate is unavailable
export const FREE_SHIPPING_ABOVE = 299;
// Default 7-day return eligibility threshold — products priced below this are final sale
// (too low-value to make a reverse-pickup return economical) unless an admin sets
// Product.returnEligibleOverride. Mirrored in Frontend/src/lib/constants.ts and
// Admin/src/lib/constants.ts.
export const RETURN_ELIGIBLE_ABOVE = 299;
export const RESERVATION_MINUTES = 15;
export const PRODUCTS_PER_PAGE = 12;
// Box + tape + padding — added once per parcel (never per item) on top of the summed
// product weights, both for the Delhivery rate quote and the weight actually declared
// when booking the shipment. Every multi-item order here ships as ONE parcel on ONE
// waybill (see checkout/service.ts's paidWeight+freeWeight and orders/service.ts's
// booking weight — both already sum all items into a single Delhivery call, never one
// call per item), so this overhead must also be flat per order, not multiplied by item
// count. Under-declaring the real packed weight risks Delhivery re-weighing the parcel
// and billing the difference — this keeps the declared weight honest.
export const PACKAGING_WEIGHT_GRAMS = 60;
