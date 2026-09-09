import type { FirebaseApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;

// Graceful degrade: if env vars are empty, analytics simply doesn't load.
// firebase/app + firebase/analytics are dynamically imported here instead of at
// module top-level — this was ~113KiB of unused/render-blocking JS parsed on every
// page load (Firebase SDK) even though analytics only ever runs after mount and
// isn't needed for anything visible. Dynamic import moves it to its own chunk,
// fetched only once the browser is idle after first paint.
export async function initFirebase() {
  if (!config.apiKey || typeof window === 'undefined') return;

  const [{ initializeApp }, { getAnalytics, isSupported }] = await Promise.all([
    import('firebase/app'),
    import('firebase/analytics'),
  ]);
  if (!(await isSupported())) return;

  app = app ?? initializeApp(config);
  analytics = analytics ?? getAnalytics(app);
}

function track(name: string, params?: Record<string, unknown>) {
  if (!analytics) return; // fire-and-forget, never blocks the caller
  // Module already loaded by initFirebase — this import resolves from cache, no new fetch.
  void import('firebase/analytics').then(({ logEvent }) => logEvent(analytics!, name, params));
}

export function trackViewItem(item: { id: string; name: string; price: number; category: string }) {
  track('view_item', { currency: 'INR', value: item.price, items: [item] });
}

export function trackAddToCart(item: { id: string; name: string; price: number; quantity: number }) {
  track('add_to_cart', { currency: 'INR', value: item.price * item.quantity, items: [item] });
}

export function trackBeginCheckout(total: number, itemCount: number) {
  track('begin_checkout', { currency: 'INR', value: total, item_count: itemCount });
}

export function trackPurchase(order: { orderNumber: string; total: number; itemCount: number }) {
  track('purchase', { transaction_id: order.orderNumber, currency: 'INR', value: order.total, item_count: order.itemCount });
}
