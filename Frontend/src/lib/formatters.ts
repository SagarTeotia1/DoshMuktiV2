export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
}

const shortDay = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Wed, 8 Oct" for a carrier-supplied date, "Wed, 8 Oct – Sat, 11 Oct" for our order-date window. */
export function formatDeliveryEstimate(
  order: { shipment: { estimatedDelivery: string | null } | null; estimatedDeliveryWindow: { from: string; to: string } | null }
): string | null {
  if (order.shipment?.estimatedDelivery) return shortDay.format(new Date(order.shipment.estimatedDelivery));
  const window = order.estimatedDeliveryWindow;
  if (!window) return null;
  return `${shortDay.format(new Date(window.from))} – ${shortDay.format(new Date(window.to))}`;
}
