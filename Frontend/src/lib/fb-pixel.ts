// Meta (Facebook) Pixel event tracking. The pixel script itself is hardcoded directly in
// <head> in app/layout.tsx (per explicit client/ad-team request) and only ever fires
// 'init' + 'track PageView' there — this file is every OTHER event (product views, cart,
// checkout, purchase, search) an ad campaign needs to actually optimize for conversions
// instead of just impressions. Mirrors lib/firebase.ts's function names/signatures 1:1
// so both providers can be driven from the same call sites via lib/analytics.ts.

type FbqFn = {
  (command: 'track', eventName: string, params?: Record<string, unknown>): void;
  (command: 'trackCustom', eventName: string, params?: Record<string, unknown>): void;
  (command: 'init', pixelId: string): void;
  queue?: unknown[];
  loaded?: boolean;
};

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

// Graceful degrade — if the pixel script hasn't loaded yet (or failed to), every call
// below is a silent no-op rather than throwing. Same fire-and-forget contract as
// lib/firebase.ts's track() so callers never need to check readiness themselves.
function fbTrack(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('track', eventName, params);
}

function fbTrackCustom(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('trackCustom', eventName, params);
}

export function trackViewItem(item: { id: string; name: string; price: number; category: string }) {
  fbTrack('ViewContent', {
    content_ids: [item.id],
    content_name: item.name,
    content_category: item.category,
    content_type: 'product',
    currency: 'INR',
    value: item.price,
  });
}

export function trackAddToCart(item: { id: string; name: string; price: number; quantity: number }) {
  fbTrack('AddToCart', {
    content_ids: [item.id],
    content_name: item.name,
    content_type: 'product',
    currency: 'INR',
    value: item.price * item.quantity,
  });
}

export function trackBeginCheckout(total: number, itemCount: number) {
  fbTrack('InitiateCheckout', { currency: 'INR', value: total, num_items: itemCount });
}

export function trackPurchase(order: { orderNumber: string; total: number; itemCount: number }) {
  fbTrack('Purchase', {
    currency: 'INR',
    value: order.total,
    num_items: order.itemCount,
    content_type: 'product',
    order_id: order.orderNumber,
  });
}

// No standard Meta event matches these four — trackCustom keeps them out of Meta's
// built-in conversion-optimization events (which expect the fixed schema above) while
// still surfacing in Events Manager / Ads Reporting under their own name.
export function trackRemoveFromCart(item: { id: string; name: string; price: number; quantity: number }) {
  fbTrackCustom('RemoveFromCart', {
    content_ids: [item.id],
    content_name: item.name,
    currency: 'INR',
    value: item.price * item.quantity,
  });
}

export function trackViewCart(items: Array<{ id: string; name: string; price: number; quantity: number }>, value: number) {
  fbTrackCustom('ViewCart', { content_ids: items.map((i) => i.id), currency: 'INR', value });
}

export function trackViewItemList(listName: string, items: Array<{ id: string; name: string; price: number }>) {
  fbTrackCustom('ViewItemList', { content_ids: items.map((i) => i.id), item_list_name: listName });
}

export function trackSelectItem(listName: string, item: { id: string; name: string; price: number }) {
  fbTrackCustom('SelectItem', { content_ids: [item.id], item_list_name: listName });
}

export function trackSearch(term: string) {
  fbTrack('Search', { search_string: term });
}

// Fired once, only on the OTP-verify call that actually creates a brand-new customer
// (not on every login) — see the isNewUser flag surfaced by
// Backend's /api/auth/otp/verify response.
export function trackCompleteRegistration() {
  fbTrack('CompleteRegistration', { content_name: 'phone_otp_signup' });
}

// AddPaymentInfo — fired when the customer commits to a payment method at checkout,
// right before the Razorpay window opens (not on every keystroke in the form).
export function trackAddPaymentInfo(total: number) {
  fbTrack('AddPaymentInfo', { currency: 'INR', value: total });
}

// Contact — WhatsApp/email/etc. channel links on the contact page. No standard param
// shape beyond currency/value (neither applies here), so this stays a bare track call.
export function trackContact() {
  fbTrack('Contact');
}
