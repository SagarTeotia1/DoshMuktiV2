import { z } from 'zod';

export const rateCalcQuerySchema = z.object({
  destPincode: z.string().regex(/^\d{6}$/, 'destPincode must be 6 digits'),
  weightGrams: z.coerce.number().int().min(1).max(50000),
  paymentMode: z.enum(['Pre-paid', 'COD']).default('Pre-paid'),
});

export const shippingEstimateQuerySchema = z.object({
  subtotal: z.coerce.number().min(0).max(10_000_000),
  weightGrams: z.coerce.number().int().min(1).max(50000),
  // Optional — omitted on cart/PDP (destination unknown yet, falls back to an
  // origin-to-origin estimate); passed once checkout has a real, validated pincode.
  destPincode: z.string().regex(/^\d{6}$/).optional(),
});
