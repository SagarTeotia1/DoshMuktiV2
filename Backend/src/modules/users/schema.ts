import { z } from 'zod';

export const listUsersQuerySchema = z.object({
  // Matches name (case-insensitive) OR phone (partial digits are fine).
  q: z.string().trim().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({ id: z.string().min(1) });
