import { z } from 'zod';

export const createReviewSchema = z.object({
  customerName: z.string().min(1).max(100),
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(10).max(2000),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const slugParamSchema = z.object({
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
});

export const adminListReviewsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminListReviewsQuery = z.infer<typeof adminListReviewsQuerySchema>;

export const moderateReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });
