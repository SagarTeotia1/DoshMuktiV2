import { redis } from '../../cache/client';
import { cacheKeys, CACHE_TTL } from '../../cache/keys';

export interface GeoInfo {
  city: string | null;
  country: string | null;
}

const UNKNOWN_GEO: GeoInfo = { city: null, country: null };

// ip-api.com's free tier: no key, 45 req/min, HTTP only (not HTTPS) — fine here since
// this is a server-to-server call, not something a browser ever sees. Result is cached
// per IP for a day (see CACHE_TTL.GEO_IP) so a repeat visitor or a multi-turn
// conversation from the same IP never re-hits it, keeping well inside the free limit
// regardless of chat volume.
export async function lookupGeo(ip: string): Promise<GeoInfo> {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return UNKNOWN_GEO;

  const cached = await redis.get<GeoInfo>(cacheKeys.geoIp(ip));
  if (cached) return cached;

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,country`);
    if (!res.ok) return UNKNOWN_GEO;
    const data = (await res.json()) as { status: string; city?: string; country?: string };
    const geo: GeoInfo = data.status === 'success' ? { city: data.city ?? null, country: data.country ?? null } : UNKNOWN_GEO;
    await redis.set(cacheKeys.geoIp(ip), geo, { ex: CACHE_TTL.GEO_IP });
    return geo;
  } catch {
    // Geo is a nice-to-have for the admin view, never worth failing/slowing a chat
    // reply over.
    return UNKNOWN_GEO;
  }
}
