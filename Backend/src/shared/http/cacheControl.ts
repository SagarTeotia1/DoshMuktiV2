import type { FastifyReply } from 'fastify';

// Sets a public, stale-while-revalidate Cache-Control header on a storefront-facing GET
// response — lets the browser and any CDN in front of Cloud Run skip a round trip to
// this process entirely for repeat requests, on top of the Redis cache the service layer
// already does. maxAgeSeconds should be <= the corresponding CACHE_TTL in shared/cache/keys.ts
// so a client's cached copy never outlives what the Redis layer would itself have refreshed.
export function setPublicCache(reply: FastifyReply, maxAgeSeconds: number, staleWhileRevalidateSeconds = maxAgeSeconds * 5) {
  reply.header('Cache-Control', `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`);
}
