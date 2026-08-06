import { z } from 'zod';
import type { RewardDefinition } from './types';
import { RewardNotImplementedError } from './types';

export const buyXGetYConfigSchema = z.object({
  buyQuantity: z.number().int().positive(),
  getQuantity: z.number().int().positive(),
  getProductId: z.string().min(1).optional(),
});
export type BuyXGetYConfig = z.infer<typeof buyXGetYConfigSchema>;

// Config/validation only — intentional stub. No checkout processor logic yet.
export const buyXGetYReward: RewardDefinition<BuyXGetYConfig> = {
  reward: 'BUY_X_GET_Y',
  configSchema: buyXGetYConfigSchema,
  process() {
    throw new RewardNotImplementedError('BUY_X_GET_Y');
  },
};
