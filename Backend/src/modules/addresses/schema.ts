import { z } from 'zod';
import { ENGLISH_TEXT_RE, ENGLISH_TEXT_MESSAGE } from '../../shared/validation/english-text';

export const addressSchema = z.object({
  name: z.string().min(1).max(200).regex(ENGLISH_TEXT_RE, ENGLISH_TEXT_MESSAGE),
  receiverPhone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  line1: z.string().min(1).max(300).regex(ENGLISH_TEXT_RE, ENGLISH_TEXT_MESSAGE),
  line2: z.string().max(300).regex(ENGLISH_TEXT_RE, ENGLISH_TEXT_MESSAGE).optional(),
  city: z.string().min(1).max(100).regex(ENGLISH_TEXT_RE, ENGLISH_TEXT_MESSAGE),
  state: z.string().min(1).max(100).regex(ENGLISH_TEXT_RE, ENGLISH_TEXT_MESSAGE),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  // true (default) — this becomes the address shown automatically next time. false lets
  // a customer save a second/alternate address without displacing their usual one.
  setDefault: z.boolean().default(true),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });
