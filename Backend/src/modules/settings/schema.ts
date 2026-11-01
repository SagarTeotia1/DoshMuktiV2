import { z } from 'zod';

const rupees = z.number().int().min(0).max(1000);

export const codFeeConfigSchema = z.object({
  threshold: z.number().int().min(0).max(100000),
  feeBelow: rupees,
  feeAbove: rupees,
});
