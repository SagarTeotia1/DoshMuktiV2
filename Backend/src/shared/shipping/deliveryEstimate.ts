// Carriers (Delhivery/Ekart) don't hand us an ETA until a waybill exists, and
// Shipment.estimatedDelivery is never populated by tracking sync today — so the customer
// would see no date at all right after paying. This gives a pure, order-date-based window
// to show from confirmation onwards. Tune these two numbers if real transit data says
// the promise is too tight/loose.
const MIN_DAYS_FROM_ORDER = 4;
const MAX_DAYS_FROM_ORDER = 7;

// No point promising a date for orders that aren't going anywhere (or already arrived).
const NO_ESTIMATE_STATUSES = new Set([
  'PENDING_PAYMENT',
  'CANCELLED',
  'REFUNDED',
  'DELIVERED',
  'RETURN_REQUESTED',
]);

export interface DeliveryWindow {
  from: string;
  to: string;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function estimateDeliveryWindow(placedAt: Date, status: string): DeliveryWindow | null {
  if (NO_ESTIMATE_STATUSES.has(status)) return null;
  return {
    from: addDays(placedAt, MIN_DAYS_FROM_ORDER).toISOString(),
    to: addDays(placedAt, MAX_DAYS_FROM_ORDER).toISOString(),
  };
}
