import { Redis } from '@upstash/redis';
import { env } from '../../config/env';

interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

// Falls back to an in-process cache when Upstash creds aren't set — same
// dev-mode degrade as V1, so `npm run dev` works before secrets are wired.
function createMemoryCache(): CacheClient {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>();

  function isLive(key: string) {
    const entry = store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      store.delete(key);
      return false;
    }
    return true;
  }

  return {
    async get<T>(key: string) {
      if (!isLive(key)) return null;
      return store.get(key)!.value as T;
    },
    async set(key, value, opts) {
      store.set(key, { value, expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : null });
      return 'OK';
    },
    async del(key) {
      store.delete(key);
      return 1;
    },
    async keys(pattern: string) {
      const prefix = pattern.replace(/\*$/, '');
      return [...store.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

export const redis: CacheClient =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? (new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }) as unknown as CacheClient)
    : createMemoryCache();
