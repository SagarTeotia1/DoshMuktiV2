import { nanoid } from 'nanoid';

const COOKIE_NAME = 'dosh_session_id';
const COOKIE_DAYS = 7;

// Non-httpOnly by design — it's a cart identifier, not a security boundary.
// See docs/SECURITY.md § Storefront traffic.
export function getSessionId(): string {
  if (typeof document === 'undefined') return '';

  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (match?.[1]) return match[1];

  const id = nanoid();
  const expires = new Date(Date.now() + COOKIE_DAYS * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${id}; expires=${expires}; path=/; SameSite=Lax`;
  return id;
}

// Derived, not stored — Backend's cart is keyed purely by whatever opaque string
// arrives in x-session-id, so this gives "Buy Now" a fully isolated one-item cart in
// Redis for free, without a new cookie or any new client-side state. Used to keep a
// single-item "Order Now" purchase from pulling in whatever is already in the
// customer's real cart. See CLAUDE.md's Buy Now fix design.
export function getBuyNowSessionId(): string {
  return getSessionId() + ':buynow';
}
