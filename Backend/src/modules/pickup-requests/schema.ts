import { z } from 'zod';

export const createPickupRequestSchema = z.object({
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'pickupDate must be YYYY-MM-DD'),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/, 'pickupTime must be HH:MM'),
});

export const listPickupRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
