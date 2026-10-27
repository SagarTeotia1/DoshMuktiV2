export const PURPOSE_IDS = ['love', 'wealth', 'health', 'success', 'protection', 'clarity', 'gifting'] as const;

export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'REFUNDED',
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  PAID: 'Paid',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return Requested',
  REFUNDED: 'Refunded',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-slate-100 text-slate-700',
  PAID: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  PACKED: 'bg-purple-100 text-purple-700',
  SHIPPED: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  RETURN_REQUESTED: 'bg-orange-100 text-orange-700',
  REFUNDED: 'bg-slate-100 text-slate-700',
};

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

// Default 7-day return eligibility threshold — mirrors Backend's RETURN_ELIGIBLE_ABOVE.
// A product's returnEligibleOverride can force it either way regardless of price.
export const RETURN_ELIGIBLE_ABOVE = 299;

// Shipping providers an admin can book on. Ekart account 1 = prepaid, account 2 = COD.
export type ShipmentProvider = 'AUTO' | 'EKART_1' | 'EKART_2' | 'DELHIVERY';
export type PickableProvider = Exclude<ShipmentProvider, 'AUTO'>;

export const PROVIDER_OPTIONS: Array<{ value: PickableProvider; label: string }> = [
  { value: 'EKART_1', label: 'Ekart 1 - Prepaid' },
  { value: 'EKART_2', label: 'Ekart 2 - COD' },
  { value: 'DELHIVERY', label: 'Delhivery' },
];

export function providerName(carrier: 'DELHIVERY' | 'EKART', ekartAccount: number | null | undefined): string {
  if (carrier === 'DELHIVERY') return 'Delhivery';
  return ekartAccount === 1 ? 'Ekart 1 - Prepaid' : 'Ekart 2 - COD';
}

export function providerValue(carrier: 'DELHIVERY' | 'EKART', ekartAccount: number | null | undefined): PickableProvider {
  if (carrier === 'DELHIVERY') return 'DELHIVERY';
  return ekartAccount === 1 ? 'EKART_1' : 'EKART_2';
}
