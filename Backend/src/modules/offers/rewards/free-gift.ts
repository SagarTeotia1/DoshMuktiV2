import { z } from 'zod';
import type { RewardDefinition } from './types';
import { getActiveVariantsSortedByStock } from '../../products/service';

export const freeGiftConfigSchema = z.object({
  productId: z.string().min(1),
});
export type FreeGiftConfig = z.infer<typeof freeGiftConfigSchema>;

// config.productId is just a string now (no more Prisma relation to offer.freeProduct),
// so this processor resolves which variant ships free itself — same rule as before:
// active variants of that product, ordered by stockQuantity desc, take the first.
export const freeGiftReward: RewardDefinition<FreeGiftConfig> = {
  reward: 'FREE_GIFT',
  configSchema: freeGiftConfigSchema,
  async process(_ctx, config) {
    const variants = await getActiveVariantsSortedByStock(config.productId);
    const freeVariant = variants[0];
    if (!freeVariant) return {};
    return { freeItems: [{ variantId: freeVariant.id, quantity: 1 }] };
  },
};
