import { z } from 'zod';

export const rateCalcQuerySchema = z.object({
  destPincode: z.string().regex(/^\d{6}$/, 'destPincode must be 6 digits'),
  weightGrams: z.coerce.number().int().min(1).max(50000),
  paymentMode: z.enum(['Pre-paid', 'COD']).default('Pre-paid'),
});

export const shippingEstimateQuerySchema = z.object({
  subtotal: z.coerce.number().min(0).max(10_000_000),
  weightGrams: z.coerce.number().int().min(1).max(50000),
});
