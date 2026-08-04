import { db } from '../../shared/db/client';
import { invalidateProductCaches } from '../products/service';
import type { CreateOfferInput, UpdateOfferInput } from './schema';

export async function listOffers() {
  return db.offer.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createOffer(input: CreateOfferInput) {
  return db.offer.create({ data: input });
}

// Offers are embedded in cached product reads (getProductBySlug/listProducts/etc.) —
// toggling isActive must bust those caches too, or the storefront serves a stale copy.
export async function updateOffer(id: string, input: UpdateOfferInput) {
  const offer = await db.offer.update({ where: { id }, data: input });
  await invalidateProductCaches();
  return offer;
}
