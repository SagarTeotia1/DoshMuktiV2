import { z } from 'zod';

const offerFieldsSchema = z.object({
  title: z.string().min(1).max(100),
  type: z.enum(['DISPLAY', 'FREE_ITEM', 'CASHBACK', 'DISCOUNT']).default('DISPLAY'),
  cashbackPercent: z.number().int().min(0).max(100).nullable().optional(),
  discountType: z.enum(['FLAT', 'PERCENT']).nullable().optional(),
  discountValue: z.number().positive().multipleOf(0.01).max(999999).nullable().optional(),
  maxDiscount: z.number().positive().multipleOf(0.01).max(999999).nullable().optional(),
  freeProductId: z.string().nullable().optional(),
});

export const createOfferSchema = offerFieldsSchema.refine(
  (data) => {
    if (data.type === 'CASHBACK') return !!data.cashbackPercent;
    if (data.type === 'DISCOUNT') return !!data.discountType && !!data.discountValue;
    if (data.type === 'FREE_ITEM') return !!data.freeProductId;
    return true;
  },
  { message: 'Missing required fields for the selected offer type' }
);

export const updateOfferSchema = offerFieldsSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });
