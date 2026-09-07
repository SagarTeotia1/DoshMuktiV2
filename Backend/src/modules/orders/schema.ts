import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().min(1) });

export const orderNumberParamSchema = z.object({
  orderNumber: z.string().regex(/^DOSH-\d{8}-\d{4}$/),
});

export const phoneQuerySchema = z.object({
  phone: z.string().regex(/^\d{10}$/),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'REFUNDED', 'PACKED']).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'REFUNDED', 'PACKED']),
  note: z.string().max(500).optional(),
});

export const raisePickupSchema = z.object({
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'pickupDate must be YYYY-MM-DD'),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/, 'pickupTime must be HH:MM'),
  expectedPackageCount: z.number().int().min(1).max(500),
});

export const ndrActionSchema = z.object({
  action: z.enum(['REATTEMPT', 'RTO']),
  reattemptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  comment: z.string().max(500).optional(),
}).refine((v) => v.action !== 'REATTEMPT' || !!v.reattemptDate, {
  message: 'reattemptDate is required when action is REATTEMPT',
  path: ['reattemptDate'],
});

export const ewaybillUpdateSchema = z.object({
  ewaybillNumber: z.string().min(1).max(50),
});

export const gstReportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  format: z.enum(['json', 'csv']).default('json'),
});
export type GstReportQuery = z.infer<typeof gstReportQuerySchema>;
