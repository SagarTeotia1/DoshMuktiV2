import { z } from 'zod';

const imageSchema = z.object({
  thumb: z.string().min(1),
  card: z.string().min(1),
  full: z.string().min(1),
});

const nameSchema = z.string().trim().min(1).max(100);
// Empty string from a cleared form field means "no custom strip name".
const stripLabelSchema = z.string().trim().max(40).transform((v) => (v === '' ? null : v)).nullable();

export const createCategorySchema = z.object({
  name: nameSchema,
  stripLabel: stripLabelSchema.optional(),
  image: imageSchema.nullable().optional(),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: nameSchema.optional(),
  stripLabel: stripLabelSchema.optional(),
  image: imageSchema.nullable().optional(),
  order: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });
