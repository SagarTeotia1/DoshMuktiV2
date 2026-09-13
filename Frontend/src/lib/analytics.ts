// Single import for every call site that tracks a storefront event — fires the same
// event to both Firebase (GA4) and Meta Pixel from one call, so neither provider can
// silently drift out of sync with the other as new tracking call sites get added.
// `initFirebase` is intentionally NOT re-exported here: it's a one-time SDK bootstrap
// (see providers/firebase-provider.tsx), not a per-event tracker, and Meta Pixel has no
// equivalent init step of its own — it's already loaded via the hardcoded <script> in
// app/layout.tsx.
import * as ga from './firebase';
import * as fb from './fb-pixel';

export function trackViewItem(item: { id: string; name: string; price: number; category: string }) {
  ga.trackViewItem(item);
  fb.trackViewItem(item);
}

export function trackAddToCart(item: { id: string; name: string; price: number; quantity: number }) {
  ga.trackAddToCart(item);
  fb.trackAddToCart(item);
}

export function trackBeginCheckout(total: number, itemCount: number) {
  ga.trackBeginCheckout(total, itemCount);
  fb.trackBeginCheckout(total, itemCount);
}

export function trackPurchase(order: { orderNumber: string; total: number; itemCount: number }) {
  ga.trackPurchase(order);
  fb.trackPurchase(order);
}

export function trackRemoveFromCart(item: { id: string; name: string; price: number; quantity: number }) {
  ga.trackRemoveFromCart(item);
  fb.trackRemoveFromCart(item);
}

export function trackViewCart(items: Array<{ id: string; name: string; price: number; quantity: number }>, value: number) {
  ga.trackViewCart(items, value);
  fb.trackViewCart(items, value);
}

export function trackViewItemList(listName: string, items: Array<{ id: string; name: string; price: number }>) {
  ga.trackViewItemList(listName, items);
  fb.trackViewItemList(listName, items);
}

export function trackSelectItem(listName: string, item: { id: string; name: string; price: number }) {
  ga.trackSelectItem(listName, item);
  fb.trackSelectItem(listName, item);
}

export function trackSearch(term: string) {
  ga.trackSearch(term);
  fb.trackSearch(term);
}

export function trackCompleteRegistration() {
  ga.trackCompleteRegistration();
  fb.trackCompleteRegistration();
}

export function trackAddPaymentInfo(total: number) {
  ga.trackAddPaymentInfo(total);
  fb.trackAddPaymentInfo(total);
}

export function trackContact() {
  ga.trackContact();
  fb.trackContact();
}
