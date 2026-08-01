import { z } from 'zod';

export const adjustStockSchema = z.object({
  variantId: z.string().min(1),
  newQuantity: z.number().int().min(0),
  note: z.string().max(500).optional(),
});
