import type { OfferReward } from '@prisma/client';
import { logger } from '../../../shared/logger/pino';
import { RewardNotImplementedError } from './types';
import type { RewardContext, RewardDefinition, RewardResult } from './types';
import { displayMessageReward } from './display-message';
import { percentageDiscountReward } from './percentage-discount';
import { flatDiscountReward } from './flat-discount';
import { cashbackReward } from './cashback';
import { freeGiftReward } from './free-gift';
import { buyXGetYReward } from './buy-x-get-y';
import { freeShippingReward } from './free-shipping';

// The strategy pattern registry — the only place that knows every reward type exists.
// Adding a new reward: one new file above + one new line here. Nothing else in the
// codebase (checkout, wallet, offers/schema.ts) should ever switch on OfferReward.
const rewardRegistry: Record<OfferReward, RewardDefinition<any>> = {
  DISPLAY_MESSAGE: displayMessageReward,
  PERCENTAGE_DISCOUNT: percentageDiscountReward,
  FLAT_DISCOUNT: flatDiscountReward,
  CASHBACK: cashbackReward,
  FREE_GIFT: freeGiftReward,
  BUY_X_GET_Y: buyXGetYReward,
  FREE_SHIPPING: freeShippingReward,
};

export function getRewardDefinition(reward: OfferReward): RewardDefinition<any> {
  return rewardRegistry[reward];
}

// Used by offers/schema.ts to validate Offer.config against the schema for whichever
// reward was selected — config shape depends on reward, so this can't be a single
// discriminated union without the discriminant living inside the config itself.
export function getConfigSchema(reward: OfferReward) {
  return rewardRegistry[reward].configSchema;
}

// Looks up the definition, validates+parses offer.config against its schema, calls
// process(). Never throws — an unimplemented reward (BUY_X_GET_Y/FREE_SHIPPING today)
// or a malformed/legacy config (e.g. a null value backfilled from an old admin PATCH
// that never set the matching column) both log a warn and return {} instead of
// propagating. Checkout and payment-webhook processing must never break because one
// offer has bad or unfinished config — a single offer failing degrades to "no reward
// applied" for that offer, not a 500 for the whole cart or a stuck-PAID order.
export async function processReward(
  offer: { id: string; reward: OfferReward; config: unknown },
  ctx: Omit<RewardContext, 'offer'>
): Promise<RewardResult> {
  const definition = getRewardDefinition(offer.reward);
  const parsed = definition.configSchema.safeParse(offer.config);
  if (!parsed.success) {
    logger.warn(
      { offerId: offer.id, reward: offer.reward, issues: parsed.error.issues },
      'Offer.config failed validation for its reward — skipping reward for this offer'
    );
    return {};
  }
  try {
    return await definition.process({ ...ctx, offer: { id: offer.id, config: offer.config } }, parsed.data);
  } catch (err) {
    if (err instanceof RewardNotImplementedError) {
      logger.warn({ offerId: offer.id, reward: offer.reward }, err.message);
      return {};
    }
    throw err;
  }
}
