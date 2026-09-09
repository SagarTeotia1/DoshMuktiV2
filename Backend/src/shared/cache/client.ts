import { Redis } from '@upstash/redis';
import { env } from '../../config/env';

interface CacheClient {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  // Atomic increment for counters (e.g. per-session daily rate limits) — returns the
  // count AFTER incrementing. ttlSeconds is only applied the first time a key is
  // created (count === 1), same semantics as Redis's INCR + conditional EXPIRE, so a
  // window resets from first-hit time rather than sliding on every request.
  incr(key: string, ttlSeconds: number): Promise<number>;
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
    async incr(key, ttlSeconds) {
      const isNew = !isLive(key);
      const current = isNew ? 0 : ((store.get(key)!.value as number) ?? 0);
      const next = current + 1;
      store.set(key, { value: next, expiresAt: isNew ? Date.now() + ttlSeconds * 1000 : store.get(key)!.expiresAt });
      return next;
    },
  };
}

function createUpstashCache(): CacheClient {
  const client = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  return {
    get: (key) => client.get(key),
    set: (key, value, opts) => client.set(key, value, opts?.ex ? { ex: opts.ex } : undefined),
    del: (key) => client.del(key),
    keys: (pattern) => client.keys(pattern),
    async incr(key, ttlSeconds) {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, ttlSeconds);
      return count;
    },
  };
}

export const redis: CacheClient =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? createUpstashCache() : createMemoryCache();
