import { z } from 'zod';
import type { RewardDefinition } from './types';
import { RewardNotImplementedError } from './types';

export const freeShippingConfigSchema = z.object({
  minOrderValue: z.number().nonnegative().optional(),
});
export type FreeShippingConfig = z.infer<typeof freeShippingConfigSchema>;

// Config/validation only — intentional stub. No checkout processor logic yet.
export const freeShippingReward: RewardDefinition<FreeShippingConfig> = {
  reward: 'FREE_SHIPPING',
  configSchema: freeShippingConfigSchema,
  process() {
    throw new RewardNotImplementedError('FREE_SHIPPING');
  },
};
