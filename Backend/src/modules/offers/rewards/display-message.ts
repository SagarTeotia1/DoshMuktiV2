import { z } from 'zod';
import type { RewardDefinition } from './types';

export const displayMessageConfigSchema = z.object({
  bannerText: z.string().min(1),
});
export type DisplayMessageConfig = z.infer<typeof displayMessageConfigSchema>;

// Pure marketing banner — no monetary effect, nothing to compute at checkout.
export const displayMessageReward: RewardDefinition<DisplayMessageConfig> = {
  reward: 'DISPLAY_MESSAGE',
  configSchema: displayMessageConfigSchema,
  process() {
    return {};
  },
};
