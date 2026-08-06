import { z } from 'zod';
import type { RewardDefinition } from './types';

export const flatDiscountConfigSchema = z.object({
  amount: z.number().positive(),
});
export type FlatDiscountConfig = z.infer<typeof flatDiscountConfigSchema>;

// Exact math preserved from the old checkout DISCOUNT/FLAT branch.
export const flatDiscountReward: RewardDefinition<FlatDiscountConfig> = {
  reward: 'FLAT_DISCOUNT',
  configSchema: flatDiscountConfigSchema,
  process(ctx, config) {
    const itemSubtotal = ctx.itemSubtotal ?? 0;
    return { discountAmount: Math.min(config.amount, itemSubtotal) };
  },
};
