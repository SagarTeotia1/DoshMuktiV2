// Mirrors Backend/src/shared/constants/purposes.ts — update both when this changes.
export const SHIPPING_FEE = 99;
export const FREE_SHIPPING_ABOVE = 999;
export const PRODUCTS_PER_PAGE = 12;

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export const SOCIAL_LINKS = {
  instagram: 'https://instagram.com/doshhmukti',
  youtube: 'https://youtube.com/@doshhmukti',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid — Ready to Pack',
  PROCESSING: 'Packing',
  PACKED: 'Packed — Ready to Ship',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  REFUNDED: 'Refunded',
};

// Amazon/Flipkart-style status colouring — green once it's actually with the
// customer, red/amber for anything that fell out of the happy path, bronze
// (the brand accent) for everything still in flight.
export const ORDER_STATUS_TONE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-[#F6E4C2] text-[#6B5539] border-[#2B1B0C]/20',
  PAID: 'bg-[#9C5A26] text-white border-[#2B1B0C]',
  PROCESSING: 'bg-[#9C5A26] text-white border-[#2B1B0C]',
  PACKED: 'bg-[#9C5A26] text-white border-[#2B1B0C]',
  SHIPPED: 'bg-[#2B6B4F] text-white border-[#2B1B0C]',
  DELIVERED: 'bg-[#2B6B4F] text-white border-[#2B1B0C]',
  CANCELLED: 'bg-brand-alert/10 text-brand-alert border-brand-alert/30',
  RETURN_REQUESTED: 'bg-brand-alert/10 text-brand-alert border-brand-alert/30',
  REFUNDED: 'bg-[#2B1B0C]/5 text-[#6B5539] border-[#2B1B0C]/15',
};

export const PURPOSES = [
  { id: 'love', label: 'Love & Relationships', description: 'Attract love, deepen bonds, open your heart' },
  { id: 'wealth', label: 'Wealth & Prosperity', description: 'Invite abundance, financial growth, good fortune' },
  { id: 'health', label: 'Health & Vitality', description: 'Physical healing, mental wellness, energy balance' },
  { id: 'success', label: 'Success & Career', description: 'Professional growth, confidence, achievement' },
  { id: 'protection', label: 'Protection & Safety', description: 'Ward off negativity, evil eye, harmful energies' },
  { id: 'clarity', label: 'Clarity & Peace', description: 'Mental stillness, meditation, inner peace' },
  { id: 'gifting', label: 'Gifting', description: 'Thoughtful spiritual gifts for someone you care about' },
] as const;

export type PurposeId = (typeof PURPOSES)[number]['id'];

export const PRODUCT_SORTS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'popular', label: 'Most Popular' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
] as const;

export type SortId = (typeof PRODUCT_SORTS)[number]['id'];
