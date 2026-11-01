import { env } from '../../config/env';
import { redis } from '../cache/client';
import { cacheKeys, CACHE_TTL } from '../cache/keys';
import { SHIPPING_FEE } from '../constants/purposes';
import { calculateShippingCost } from '../integrations/delhivery/client';
import { estimateEkartCost } from '../integrations/ekart/client';
import { logger } from '../logger/pino';
import { chooseEkartAccount, type CarrierId } from './carrier';

export interface PrepaidRate {
  /** GST-inclusive shipping cost, rounded up to the rupee. */
  fee: number;
  /** The cheaper carrier for this route+weight; null when neither quote worked (flat fallback). */
  carrier: CarrierId | null;
}

function isPrepaidRate(v: unknown): v is PrepaidRate {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as { fee?: unknown; carrier?: unknown };
  return typeof r.fee === 'number' && (r.carrier === null || r.carrier === 'EKART' || r.carrier === 'DELHIVERY');
}

// Prepaid parcels can ship on Ekart (account 1) or Delhivery - quote both and take the cheaper.
// A carrier whose quote fails is simply out of the race; if both fail we fall back to the flat
// SHIPPING_FEE (uncached, so the next call retries). Never throws - rates must not block checkout.
// Ties go to Ekart (the default carrier).
export async function cheapestPrepaidRate(subtotal: number, weightGrams: number, destPincode: string): Promise<PrepaidRate> {
  const originPincode = env.DELHIVERY_WAREHOUSE_PINCODE;
  const key = cacheKeys.prepaidRate(originPincode, destPincode, weightGrams);
  const cached = await redis.get<unknown>(key).catch(() => null);
  if (isPrepaidRate(cached)) return cached;

  const [ekart, delhivery] = await Promise.all([
    estimateEkartCost(chooseEkartAccount('PREPAID'), {
      originPincode,
      destPincode,
      weight: weightGrams,
      codAmount: 0,
      invoiceAmount: subtotal,
    }).catch(() => null),
    calculateShippingCost({ originPincode, destPincode, weightGrams, paymentMode: 'Pre-paid' }).catch(() => null),
  ]);

  const ekartFee = ekart ? Math.ceil(ekart.total) : null;
  const delhiveryFee = delhivery ? Math.ceil(delhivery.amount) : null;

  let rate: PrepaidRate;
  if (ekartFee !== null && (delhiveryFee === null || ekartFee <= delhiveryFee)) {
    rate = { fee: ekartFee, carrier: 'EKART' };
  } else if (delhiveryFee !== null) {
    rate = { fee: delhiveryFee, carrier: 'DELHIVERY' };
  } else {
    logger.warn({ originPincode, destPincode, weightGrams }, 'Prepaid rate quotes failed on both carriers - falling back to flat SHIPPING_FEE');
    return { fee: SHIPPING_FEE, carrier: null };
  }

  logger.info({ originPincode, destPincode, weightGrams, ekartFee, delhiveryFee, chosen: rate.carrier, fee: rate.fee }, 'Prepaid rate: cheaper carrier picked');
  await redis.set(key, rate, { ex: CACHE_TTL.SHIPPING_RATE }).catch(() => undefined);
  return rate;
}
