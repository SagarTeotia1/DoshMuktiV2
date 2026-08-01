const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

export const api = {
  get: <T>(path: string, headers?: HeadersInit) => request<T>(path, { headers }),
  post: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),
  patch: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body), headers }),
  delete: <T>(path: string, headers?: HeadersInit) => request<T>(path, { method: 'DELETE', headers }),
};
