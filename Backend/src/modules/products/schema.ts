import { z } from 'zod';
import { PURPOSE_IDS, PRODUCT_SORTS } from '../../shared/constants/purposes';

export const listProductsQuerySchema = z.object({
  purpose: z.enum(PURPOSE_IDS).optional(),
  category: z.string().min(1).max(100).optional(),
  q: z.string().min(1).max(200).optional(),
  sort: z.enum(PRODUCT_SORTS).default('newest'),
  page: z.coerce.number().int().min(1).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  featured: z.coerce.boolean().optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const slugParamSchema = z.object({
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
});

export const listAdminProductsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListAdminProductsQuery = z.infer<typeof listAdminProductsQuerySchema>;

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().min(1),
  category: z.string().min(1).max(100),
  basePrice: z.number().positive().multipleOf(0.01).max(999999),
  compareAtPrice: z.number().positive().multipleOf(0.01).max(999999).nullable().optional(),
  images: z.array(z.object({ thumb: z.string(), card: z.string(), full: z.string() })).default([]),
  purpose: z.array(z.enum(PURPOSE_IDS)).default([]),
  badge: z.string().max(50).nullable().optional(),
  featured: z.boolean().default(false),
  benefits: z.array(z.object({ title: z.string().min(1), description: z.string().min(1) })).default([]),
  howToWear: z.array(z.string().min(1)).default([]),
  careInstructions: z.string().optional().nullable(),
  socialProofText: z.string().max(100).optional().nullable(),
  tags: z.array(z.string().min(1).max(40)).max(6).default([]),
  cashbackPercent: z.number().int().min(0).max(100).nullable().optional(),
  descriptionImages: z.array(z.object({ thumb: z.string(), card: z.string(), full: z.string() })).default([]),
  howToUseVideoUrl: z.string().url().max(500).nullable().optional(),
  sidhiPrice: z.number().int().positive().max(999999).nullable().optional(),
  selfEnergizeInstructions: z.string().max(5000).nullable().optional(),
  offerIds: z.array(z.string()).default([]),
});

export const updateProductSchema = createProductSchema.partial().extend({
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createVariantSchema = z.object({
  sku: z.string().min(1).max(100),
  attributes: z.record(z.string()).default({}),
  priceOverride: z.number().positive().multipleOf(0.01).max(999999).nullable().optional(),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  weight: z.number().int().min(1).default(500),
});

export const updateVariantSchema = createVariantSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });
