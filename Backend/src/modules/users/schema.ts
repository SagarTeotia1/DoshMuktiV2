import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  phone: z.string().min(1).max(20).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
