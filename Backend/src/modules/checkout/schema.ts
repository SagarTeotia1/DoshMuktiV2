import { z } from 'zod';

export const checkoutSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  customerEmail: z.string().email().toLowerCase().optional(),
  shippingAddress: z.object({
    line1: z.string().min(1).max(300),
    line2: z.string().max(300).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    country: z.string().default('IN'),
  }),
  items: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().int().min(1).max(99),
  })).min(1),
  walletRedeem: z.number().min(0).max(999999).default(0),
  couponCode: z.string().optional(),
  // Purely to make BIRTHDAY-type coupons functional — no Frontend UI collects this yet,
  // so in practice BIRTHDAY coupons fail findValidatedCoupon's eligibility check unless
  // a future feature adds that input. Deliberate, fail-closed scope boundary.
  customerDob: z.coerce.date().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
