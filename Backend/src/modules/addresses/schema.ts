import { z } from 'zod';

export const addressSchema = z.object({
  name: z.string().min(1).max(200),
  receiverPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  line1: z.string().min(1).max(300),
  line2: z.string().max(300).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  // true (default) — this becomes the address shown automatically next time. false lets
  // a customer save a second/alternate address without displacing their usual one.
  setDefault: z.boolean().default(true),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });
