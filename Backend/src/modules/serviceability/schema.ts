import { z } from 'zod';

export const pincodeQuerySchema = z.object({
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
});
