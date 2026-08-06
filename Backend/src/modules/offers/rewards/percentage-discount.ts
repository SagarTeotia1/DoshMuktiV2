import { z } from 'zod';
import type { RewardDefinition } from './types';

export const percentageDiscountConfigSchema = z.object({
  percent: z.number().min(0).max(100),
  maxDiscount: z.number().positive().optional(),
});
export type PercentageDiscountConfig = z.infer<typeof percentageDiscountConfigSchema>;

// Exact math preserved from the old checkout DISCOUNT/PERCENT branch.
export const percentageDiscountReward: RewardDefinition<PercentageDiscountConfig> = {
  reward: 'PERCENTAGE_DISCOUNT',
  configSchema: percentageDiscountConfigSchema,
  process(ctx, config) {
    const itemSubtotal = ctx.itemSubtotal ?? 0;
    const discountAmount = Math.min((itemSubtotal * config.percent) / 100, config.maxDiscount ?? Infinity);
    return { discountAmount };
  },
};
