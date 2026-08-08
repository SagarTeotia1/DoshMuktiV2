import { z } from "zod";

export const couponTypeSchema = z.enum(["FLAT", "PERCENT", "BIRTHDAY"]);

// Normalized to uppercase at the schema boundary so "save10" and "SAVE10" are the
// same coupon everywhere downstream (create, update, findValidatedCoupon lookup) —
// one canonical casing, never re-derived ad hoc in multiple places.
const codeSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Code must contain only letters, numbers, hyphens, or underscores",
  )
  .transform((s) => s.toUpperCase());

const couponFieldsSchema = z.object({
  code: codeSchema,
  type: couponTypeSchema,
  // PERCENT/BIRTHDAY value is a 0-100 percentage; FLAT value is a ₹ amount with no such
  // bound. This schema can't express "positive, and also <=100 iff type isn't FLAT" for
  // partial updates (a PATCH might send `value` without resending `type`) — that merged
  // check lives in coupons/service.ts's assertValidCouponValue, called by both
  // createCoupon and updateCoupon against the merged (existing + incoming) type/value.
  // This .positive() is just the always-true baseline; the real percent bound is there.
  value: z.number().positive(),
  // ₹ minimum order subtotal required to redeem — optional (no minimum). Nullable, not
  // just optional: the Admin form sends `null` (not an omitted key) for every blank
  // optional field, on both create and update — `null` on an update also has to mean
  // "clear this field," the same "nullable so an update can explicitly clear it" pattern
  // already used for Offer.couponId/category. `.optional()` alone rejects `null` outright.
  minOrder: z.number().nonnegative().nullable().optional(),
  // Total number of redemptions allowed across all customers — optional (unlimited).
  maxUses: z.number().int().positive().nullable().optional(),
  // Cap for PERCENT/BIRTHDAY type discounts — optional (no cap).
  maxDiscount: z.number().positive().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

// Full-object create can enforce the percent bound directly (type is always present).
export const createCouponSchema = couponFieldsSchema.superRefine(
  (data, ctx) => {
    if (data.type !== "FLAT" && data.value > 100) {
      ctx.addIssue({
        path: ["value"],
        code: z.ZodIssueCode.custom,
        message: "Percent value must be 100 or less",
      });
    }
  },
);
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = couponFieldsSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });

export const listCouponsQuerySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  status: z.enum(["active", "archived"]).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});
export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>;

// Public preview endpoint — the storefront calls this interactively as the customer
// types a code, before checkout. No customerDob field here: this round has no
// Frontend UI collecting a customer's date of birth, so BIRTHDAY coupons will always
// preview as ineligible (fail-closed, see findValidatedCoupon).
export const previewCouponSchema = z.object({
  code: z.string().min(1),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
});
export type PreviewCouponInput = z.infer<typeof previewCouponSchema>;
