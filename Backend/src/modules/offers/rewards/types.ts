import type { OfferReward } from '@prisma/client';
import type { ZodType } from 'zod';

// Uniform interface every reward processor implements — adding a new reward means
// adding one new file in this directory + one line in registry.ts, never editing a
// switch statement in checkout/wallet. See CLAUDE.md "no giant switch statements".

export interface RewardContext {
  offer: { id: string; config: unknown };
  // Both optional: FREE_GIFT resolves its own product from config and doesn't need
  // the cart line item; PERCENTAGE_DISCOUNT/FLAT_DISCOUNT/CASHBACK need itemSubtotal.
  productId?: string;
  itemSubtotal?: number; // price * quantity for the matching line item, when relevant
}

export interface RewardResult {
  discountAmount?: number;
  freeItems?: Array<{ variantId: string; quantity: number }>;
  cashbackAmount?: number;
}

export interface RewardDefinition<TConfig> {
  reward: OfferReward;
  configSchema: ZodType<TConfig>;
  process(ctx: RewardContext, config: TConfig): Promise<RewardResult> | RewardResult;
}

// Thrown by rewards that only have their config schema defined so far (BUY_X_GET_Y,
// FREE_SHIPPING) — registry.processReward catches this and no-ops with a warn log,
// so checkout never breaks because an admin enabled an unfinished reward type.
export class RewardNotImplementedError extends Error {
  constructor(reward: string) {
    super(`Reward processor not implemented: ${reward}`);
    this.name = 'RewardNotImplementedError';
  }
}
