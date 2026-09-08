import { z } from 'zod';

export const createSectionSchema = z.object({
  key: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

export const setSectionItemsSchema = z.object({
  productIds: z.array(z.string().min(1)).max(50),
});
export type SetSectionItemsInput = z.infer<typeof setSectionItemsSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });
