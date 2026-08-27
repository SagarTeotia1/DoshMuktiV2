import { z } from 'zod';

const imageSchema = z.object({
  thumb: z.string().min(1),
  card: z.string().min(1),
  full: z.string().min(1),
});

export const createBannerSchema = z.object({
  image: imageSchema,
  mobileImage: imageSchema.nullable().optional(),
  link: z.string().min(1).max(2048),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type CreateBannerInput = z.infer<typeof createBannerSchema>;

export const updateBannerSchema = z.object({
  image: imageSchema.optional(),
  mobileImage: imageSchema.nullable().optional(),
  link: z.string().min(1).max(2048).optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });
