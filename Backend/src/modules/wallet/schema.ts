import { z } from 'zod';

export const walletBalanceQuerySchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
});
export type WalletBalanceQuery = z.infer<typeof walletBalanceQuerySchema>;

export const adminWalletAdjustSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  amount: z.number().refine((n) => n !== 0, 'Amount must be non-zero'), // positive = grant, negative = deduct
  note: z.string().min(1).max(300),
});
export type AdminWalletAdjustInput = z.infer<typeof adminWalletAdjustSchema>;
