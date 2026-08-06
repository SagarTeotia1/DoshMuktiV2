import { z } from 'zod';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { Offer, OfferBehavior, OfferConfig, OfferReward, OfferScope } from '@/types/api.types';

export const OFFER_BEHAVIORS: Array<{ value: OfferBehavior; label: string; helper: string }> = [
  { value: 'DISPLAY_ONLY', label: 'Display Only', helper: 'Shown as a badge/tag on the product — no price or checkout effect.' },
  { value: 'AUTO_APPLIED', label: 'Auto Applied', helper: 'Applied automatically at checkout for eligible products — no code needed.' },
  { value: 'COUPON_BASED', label: 'Coupon Based', helper: 'Only applies when the customer enters a matching coupon code.' },
];

export const OFFER_SCOPES: Array<{ value: OfferScope; label: string; helper: string }> = [
  {
    value: 'SPECIFIC_PRODUCTS',
    label: 'Specific Products',
    helper: 'Pick individual products below — or leave empty and link them later from each product’s Edit page.',
  },
  {
    value: 'CATEGORY',
    label: 'Entire Category',
    helper: 'Applies automatically to every active product in the chosen category.',
  },
  {
    value: 'ALL_PRODUCTS',
    label: 'All Products',
    helper: 'Applies automatically to every active product store-wide.',
  },
];

export const OFFER_REWARDS: Array<{ value: OfferReward; label: string }> = [
  { value: 'DISPLAY_MESSAGE', label: 'Display Message' },
  { value: 'PERCENTAGE_DISCOUNT', label: 'Percentage Discount' },
  { value: 'FLAT_DISCOUNT', label: 'Flat Discount' },
  { value: 'CASHBACK', label: 'Cashback' },
  { value: 'FREE_GIFT', label: 'Free Gift' },
  { value: 'BUY_X_GET_Y', label: 'Buy X Get Y' },
  { value: 'FREE_SHIPPING', label: 'Free Shipping' },
];

// A blank <input type="number"> registered via RHF's uncontrolled `register()` (no
// `valueAsNumber`) yields the raw string "", not undefined — and z.coerce.number()
// coerces "" to 0 (JS: `Number("")` === 0), not undefined. Left unhandled, a blank
// optional number field silently submits as 0 instead of "not set." This strips ""
// back to undefined before coercion runs. Same pattern as CouponForm's `optionalNumber`.
const optionalNumber = (schema: z.ZodNumber) => z.preprocess((val) => (val === '' ? undefined : val), schema.optional());

// Flattened form shape: every possible per-reward config field lives at the
// top level (all optional), and `superRefine` enforces which ones are
// required based on the currently-selected `reward`/`behavior`. On submit
// this gets folded back into the narrow `OfferConfig` shape the backend
// expects (see `buildOfferConfig` below) — the flattening is only a
// react-hook-form convenience, never leaks past the submit boundary.
export const offerFormSchema = z
  .object({
    title: z.string().min(1, 'Required'),
    behavior: z.enum(['DISPLAY_ONLY', 'AUTO_APPLIED', 'COUPON_BASED']),
    reward: z.enum(['DISPLAY_MESSAGE', 'PERCENTAGE_DISCOUNT', 'FLAT_DISCOUNT', 'CASHBACK', 'FREE_GIFT', 'BUY_X_GET_Y', 'FREE_SHIPPING']),
    couponId: z.string().optional(),
    // Top-level spend-threshold condition on the offer itself (behavior-scoped, not
    // reward-scoped) — deliberately named differently from the `minOrderValue` field
    // below, which is the FREE_SHIPPING reward's own config field. Meaningful for
    // DISPLAY_ONLY/AUTO_APPLIED; cleared to null for COUPON_BASED on submit (see OfferForm).
    conditionMinOrderValue: optionalNumber(z.coerce.number().min(0)),
    // Who the offer targets — independent axis from behavior/reward.
    scope: z.enum(['SPECIFIC_PRODUCTS', 'CATEGORY', 'ALL_PRODUCTS']).default('SPECIFIC_PRODUCTS'),
    category: z.string().optional(), // required iff scope === 'CATEGORY', enforced below
    productIds: z.array(z.string()).default([]), // only meaningful when scope === 'SPECIFIC_PRODUCTS'; zero is a valid, unlinked state
    // DISPLAY_MESSAGE
    bannerText: z.string().optional(),
    // PERCENTAGE_DISCOUNT / CASHBACK share `percent`
    percent: z.coerce.number().min(0).max(100).optional(),
    // PERCENTAGE_DISCOUNT
    maxDiscount: z.coerce.number().min(0).optional(),
    // FLAT_DISCOUNT
    amount: z.coerce.number().min(0).optional(),
    // FREE_GIFT
    freeGiftProductId: z.string().optional(),
    // BUY_X_GET_Y
    buyQuantity: z.coerce.number().int().positive().optional(),
    getQuantity: z.coerce.number().int().positive().optional(),
    getProductId: z.string().optional(),
    // FREE_SHIPPING
    minOrderValue: z.coerce.number().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    switch (data.reward) {
      case 'DISPLAY_MESSAGE':
        if (!data.bannerText?.trim()) ctx.addIssue({ path: ['bannerText'], code: z.ZodIssueCode.custom, message: 'Required' });
        break;
      case 'PERCENTAGE_DISCOUNT':
        if (data.percent === undefined) ctx.addIssue({ path: ['percent'], code: z.ZodIssueCode.custom, message: 'Required' });
        break;
      case 'FLAT_DISCOUNT':
        // Backend requires amount > 0 (z.number().positive()) — 0 is rejected server-side,
        // so it must be flagged here too or the form submits a config the backend 400s on.
        if (!data.amount || data.amount <= 0) ctx.addIssue({ path: ['amount'], code: z.ZodIssueCode.custom, message: 'Must be greater than 0' });
        break;
      case 'CASHBACK':
        if (data.percent === undefined) ctx.addIssue({ path: ['percent'], code: z.ZodIssueCode.custom, message: 'Required' });
        break;
      case 'FREE_GIFT':
        if (!data.freeGiftProductId) ctx.addIssue({ path: ['freeGiftProductId'], code: z.ZodIssueCode.custom, message: 'Required' });
        break;
      case 'BUY_X_GET_Y':
        if (data.buyQuantity === undefined) ctx.addIssue({ path: ['buyQuantity'], code: z.ZodIssueCode.custom, message: 'Required' });
        if (data.getQuantity === undefined) ctx.addIssue({ path: ['getQuantity'], code: z.ZodIssueCode.custom, message: 'Required' });
        break;
      case 'FREE_SHIPPING':
        break;
    }
    if (data.behavior === 'COUPON_BASED' && !data.couponId?.trim()) {
      ctx.addIssue({ path: ['couponId'], code: z.ZodIssueCode.custom, message: 'Pick a coupon for coupon-based offers' });
    }
    if (data.scope === 'CATEGORY' && !data.category?.trim()) {
      ctx.addIssue({ path: ['category'], code: z.ZodIssueCode.custom, message: 'Pick a category' });
    }
    // Intentionally no "at least one product" check for SPECIFIC_PRODUCTS —
    // an offer can be created with zero products linked and assigned later
    // from each product's Edit page, same as before this feature existed.
  });

export type OfferFormShape = z.infer<typeof offerFormSchema>;

export type RewardFieldsProps = {
  register: UseFormRegister<OfferFormShape>;
  errors: FieldErrors<OfferFormShape>;
};

/** Folds the flattened form fields back into the narrow per-reward config shape the backend expects. */
export function buildOfferConfig(values: OfferFormShape): OfferConfig {
  switch (values.reward) {
    case 'DISPLAY_MESSAGE':
      return { bannerText: values.bannerText!.trim() };
    case 'PERCENTAGE_DISCOUNT':
      return { percent: values.percent!, ...(values.maxDiscount ? { maxDiscount: values.maxDiscount } : {}) };
    case 'FLAT_DISCOUNT':
      return { amount: values.amount! };
    case 'CASHBACK':
      return { percent: values.percent! };
    case 'FREE_GIFT':
      return { productId: values.freeGiftProductId! };
    case 'BUY_X_GET_Y':
      return {
        buyQuantity: values.buyQuantity!,
        getQuantity: values.getQuantity!,
        ...(values.getProductId ? { getProductId: values.getProductId } : {}),
      };
    case 'FREE_SHIPPING':
      return values.minOrderValue ? { minOrderValue: values.minOrderValue } : {};
  }
}

/** Inverse of `buildOfferConfig` — used to seed the flattened form defaults when editing an existing offer. */
export function offerToFormDefaults(offer?: Offer): Partial<OfferFormShape> {
  if (!offer) return { behavior: 'DISPLAY_ONLY', reward: 'DISPLAY_MESSAGE', scope: 'SPECIFIC_PRODUCTS' };

  const base: Partial<OfferFormShape> = {
    title: offer.title,
    behavior: offer.behavior,
    reward: offer.reward,
    couponId: offer.couponId ?? '',
    scope: offer.scope,
    category: offer.category ?? '',
    productIds: offer.productIds,
    conditionMinOrderValue: offer.minOrderValue ?? undefined,
  };

  switch (offer.reward) {
    case 'DISPLAY_MESSAGE':
      return { ...base, bannerText: offer.config.bannerText };
    case 'PERCENTAGE_DISCOUNT':
      return { ...base, percent: offer.config.percent, maxDiscount: offer.config.maxDiscount };
    case 'FLAT_DISCOUNT':
      return { ...base, amount: offer.config.amount };
    case 'CASHBACK':
      return { ...base, percent: offer.config.percent };
    case 'FREE_GIFT':
      return { ...base, freeGiftProductId: offer.config.productId };
    case 'BUY_X_GET_Y':
      return { ...base, buyQuantity: offer.config.buyQuantity, getQuantity: offer.config.getQuantity, getProductId: offer.config.getProductId };
    case 'FREE_SHIPPING':
      return { ...base, minOrderValue: offer.config.minOrderValue };
  }
}
