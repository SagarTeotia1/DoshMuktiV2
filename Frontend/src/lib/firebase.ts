import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, logEvent, isSupported, type Analytics } from 'firebase/analytics';

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
export async function initFirebase() {
  if (!config.apiKey || typeof window === 'undefined') return;
  if (!(await isSupported())) return;

  app = app ?? initializeApp(config);
  analytics = analytics ?? getAnalytics(app);
}

function track(name: string, params?: Record<string, unknown>) {
  if (!analytics) return; // fire-and-forget, never blocks the caller
  logEvent(analytics, name, params);
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
