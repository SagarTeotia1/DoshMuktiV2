import { redis } from '../../shared/cache/client';
import { cacheKeys, CACHE_TTL } from '../../shared/cache/keys';
import { checkServiceability } from '../../shared/integrations/delhivery/client';

export async function isPincodeServiceable(pincode: string): Promise<boolean> {
  const key = cacheKeys.pincode(pincode);
  const cached = await redis.get<boolean>(key);
  if (cached !== null) return cached;

  const result = await checkServiceability(pincode);
  await redis.set(key, result, { ex: CACHE_TTL.PINCODE });
  return result;
}
