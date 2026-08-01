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
