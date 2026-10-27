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

// "3 Nov - 6 Nov 2026" in IST, for customer messages (WhatsApp confirmation). Dates are shown
// in India time regardless of the server's timezone.
export function formatDeliveryWindowText(window: DeliveryWindow): string {
  const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const full = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
  return `${day.format(new Date(window.from))} - ${full.format(new Date(window.to))}`;
}
