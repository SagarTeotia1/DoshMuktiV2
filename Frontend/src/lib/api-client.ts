const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

export function invoiceUrl(orderNumber: string): string {
  return `${BASE_URL}/api/orders/${orderNumber}/invoice`;
}

export interface ApiErrorBody {
  error: string;
  details?: Record<string, string[]>;
  code?: string;
}

export class ApiError extends Error {
  constructor(public status: number, public body: ApiErrorBody) {
    super(body.error);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit & { next?: { revalidate?: number } }): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as ApiErrorBody;
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Reads default to a short cache — during RSC/SSR fetches this lets Next skip a full
 * backend round-trip on every nav (that was the main cause of sluggish tab switches).
 * Client-side fetches (TanStack Query hooks) run in-browser and ignore this entirely.
 * Pass revalidate: 0 for anything that must always be live (order status, etc). */
export const api = {
  get: <T>(path: string, headers?: HeadersInit, revalidate = 60) =>
    request<T>(path, { headers, next: { revalidate } }),
  post: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), headers, cache: 'no-store' }),
  patch: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), headers, cache: 'no-store' }),
  delete: <T>(path: string, headers?: HeadersInit) => request<T>(path, { method: 'DELETE', headers, cache: 'no-store' }),
};
