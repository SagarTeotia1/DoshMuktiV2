import { getToken, clearToken } from './auth';

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
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as ApiErrorBody;
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/csv')) return res.text() as unknown as Promise<T>;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => {
    const token = getToken();
    return fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const body = (await res.json().catch(() => ({ error: 'Upload failed' }))) as ApiErrorBody;
        throw new ApiError(res.status, body);
      }
      return res.json() as Promise<T>;
    });
  },
};
