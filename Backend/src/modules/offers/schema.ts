import { z } from 'zod';
import { getConfigSchema } from './rewards/registry';

export const offerBehaviorSchema = z.enum(['DISPLAY_ONLY', 'AUTO_APPLIED', 'COUPON_BASED']);
export const offerRewardSchema = z.enum([
  'DISPLAY_MESSAGE',
  'PERCENTAGE_DISCOUNT',
  'FLAT_DISCOUNT',
  'CASHBACK',
  'FREE_GIFT',
  'BUY_X_GET_Y',
  'FREE_SHIPPING',
]);
export const offerScopeSchema = z.enum(['SPECIFIC_PRODUCTS', 'CATEGORY', 'ALL_PRODUCTS']);

const offerFieldsSchema = z.object({
  title: z.string().min(1).max(100),
  behavior: offerBehaviorSchema,
  reward: offerRewardSchema,
  // Raw here — validated against the reward-specific schema below via superRefine,
  // since Zod discriminated unions don't nest cleanly with a separately-computed key
  // (the config shape depends on `reward`, which lives in a sibling field).
  config: z.record(z.string(), z.unknown()),
  // Settable only when behavior === 'COUPON_BASED' — enforced below. Nullable so an
  // update can explicitly clear it (e.g. switching behavior away from COUPON_BASED).
  couponId: z.string().min(1).nullable().optional(),
  // Defaults to SPECIFIC_PRODUCTS on create (unset on create → default applies). On
  // update this is wrapped in .optional() by .partial() below, which short-circuits on
  // an omitted field before the default ever runs — so an update that doesn't mention
  // scope leaves the existing scope untouched, it does NOT get reset to the default.
  scope: offerScopeSchema.default('SPECIFIC_PRODUCTS'),
  // Meaningful only when scope === 'CATEGORY' — required there (enforced below),
  // ignored/cleared by the service layer for any other scope. Nullable so an update can
  // explicitly clear it.
  category: z.string().min(1).nullable().optional(),
  // NEW: offers can now be assigned products directly at creation/update time, not only
  // from each product's own edit page. Meaningful only when scope === 'SPECIFIC_PRODUCTS'
  // — rejected below if a non-empty list is sent alongside a different scope.
  productIds: z.array(z.string().min(1)).optional(),
  // Minimum cart subtotal required for this offer's reward to apply — independent of
  // reward config, since any reward can carry a spend threshold (unlike Coupon.minOrder,
  // which is redemption-specific to COUPON_BASED). Only enforced at checkout for
  // AUTO_APPLIED offers (see resolveAutoAppliedRewardsForCheckout in service.ts);
  // informational-only for DISPLAY_ONLY, ignored entirely for COUPON_BASED. Nullable so
  // an update can explicitly clear it — Admin's forms send null, not an omitted key, for
  // a blanked-out optional number field.
  minOrderValue: z.number().nonnegative().nullable().optional(),
});

// Shared by create (all fields required) and update (all fields partial) — validates
// config against whichever reward's schema applies, and the couponId/behavior pairing.
// Note: on update, this only fires when both `reward` and `config` are present in the
// same request; a partial update that changes just one of them is re-validated against
// the merged, persisted offer in offers/service.ts before it hits the database.
function refineOfferFields(
  data: {
    behavior?: string;
    reward?: string;
    config?: Record<string, unknown>;
    couponId?: string | null;
    scope?: string;
    category?: string | null;
    productIds?: string[];
  },
  ctx: z.RefinementCtx
) {
  if (data.reward && data.config) {
    const configSchema = getConfigSchema(data.reward as Parameters<typeof getConfigSchema>[0]);
    const result = configSchema.safeParse(data.config);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({ ...issue, path: ['config', ...issue.path] });
      }
    }
  }

  if (data.couponId && data.behavior && data.behavior !== 'COUPON_BASED') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['couponId'],
      message: 'couponId can only be set when behavior is COUPON_BASED',
    });
  }

  if (data.behavior === 'COUPON_BASED' && !data.couponId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['couponId'],
      message: 'couponId is required when behavior is COUPON_BASED',
    });
  }

  // Same "fires when the relevant field is present in this request" style as the
  // couponId/behavior pair above — on update, a request that doesn't touch scope skips
  // this and is re-validated against the merged, persisted offer in offers/service.ts.
  if (data.scope === 'CATEGORY' && !data.category) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['category'],
      message: 'category is required when scope is CATEGORY',
    });
  }

  // productIds is only meaningful for SPECIFIC_PRODUCTS — rejected (not silently
  // ignored) when sent non-empty alongside a different scope, so a stray productIds
  // list from a form that didn't reset itself on scope change surfaces as a 400
  // instead of quietly doing nothing.
  if (data.scope && data.scope !== 'SPECIFIC_PRODUCTS' && data.productIds && data.productIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['productIds'],
      message: 'productIds can only be set when scope is SPECIFIC_PRODUCTS',
    });
  }
}

// Offers can now be assigned products directly at creation/update time (productIds),
// in addition to the M:N link toggled from each product's own edit page — see
// offers/service.ts's createOffer/updateOffer for how it's applied.
export const createOfferSchema = offerFieldsSchema.superRefine(refineOfferFields);

export const updateOfferSchema = offerFieldsSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .superRefine(refineOfferFields);

export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

export const idParamSchema = z.object({ id: z.string().min(1) });

export const listOffersQuerySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  behavior: offerBehaviorSchema.optional(),
  reward: offerRewardSchema.optional(),
  status: z.enum(['active', 'archived']).optional(),
  page: z.coerce.number().int().min(1).max(999).default(1),
  // Capped at 500, not 100 — the product-edit offer picker (ProductForm.tsx) fetches the
  // whole active offer catalog in one page for its checkbox list, not just a table page.
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
});
export type ListOffersQuery = z.infer<typeof listOffersQuerySchema>;
