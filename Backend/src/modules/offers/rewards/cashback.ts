import { z } from 'zod';
import type { RewardDefinition } from './types';

export const cashbackConfigSchema = z.object({
  percent: z.number().min(0).max(100),
});
export type CashbackConfig = z.infer<typeof cashbackConfigSchema>;

// Exact math preserved from wallet/service.ts creditCashbackForOrder's old offerPct
// branch: (priceAtPurchase * quantity * pct) / 100, i.e. itemSubtotal * pct / 100.
// CASHBACK is never evaluated at checkout (behavior filter excludes it) — only here,
// post-payment, from the webhook.
export const cashbackReward: RewardDefinition<CashbackConfig> = {
  reward: 'CASHBACK',
  configSchema: cashbackConfigSchema,
  process(ctx, config) {
    const itemSubtotal = ctx.itemSubtotal ?? 0;
    return { cashbackAmount: (itemSubtotal * config.percent) / 100 };
  },
};
