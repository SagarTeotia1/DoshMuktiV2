import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  otp: z.string().regex(/^\d{4,6}$/, 'Invalid OTP'),
  name: z.string().min(1).max(100).optional(),
  dob: z.string().date().optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
