import { z } from 'zod';

export const salesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
