const COOKIE_NAME = 'dosh_admin_token';
const COOKIE_HOURS = 12; // matches Backend JWT expiresIn

export function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match?.[1] ?? null;
}

export function setToken(token: string): void {
  const expires = new Date(Date.now() + COOKIE_HOURS * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${token}; expires=${expires}; path=/; SameSite=Lax`;
}

export function clearToken(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}
