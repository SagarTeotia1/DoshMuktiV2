'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Coupon, CouponType } from '@/types/api.types';
import type { CreateCouponInput, UpdateCouponInput } from '@/hooks/use-coupons';

const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

const COUPON_TYPES: Array<{ value: CouponType; label: string; helper: string }> = [
  { value: 'FLAT', label: 'Flat', helper: 'A fixed ₹ amount off the order total.' },
  { value: 'PERCENT', label: 'Percent', helper: 'A percentage off the order total, optionally capped by Max Discount.' },
  {
    value: 'BIRTHDAY',
    label: 'Birthday',
    helper:
      "Only valid on the customer's date of birth — requires DOB, which isn't collected at checkout yet, so this type is not usable until that ships.",
  },
];

// Flattened, mirrors the backend's coupon validation shape. `code` is
// transformed to uppercase/trimmed on submit — the input itself just shows
// uppercase via CSS so admins see the normalized form while typing.
// A blank <input type="number"> registered via RHF's uncontrolled `register()` (no
// `valueAsNumber`) yields the raw string "", not undefined — and z.coerce.number()
// coerces "" to 0 (JS: `Number("")` === 0), not undefined. Left unhandled, every blank
// optional number field silently submits as 0 instead of "not set": harmless for
// minOrder (0 = no minimum, same effect) but maxDiscount/maxUses both require a
// strictly-positive value server-side, so a blank field always failed there with a
// generic "Invalid input" — completely independent of, and not fixed by, making the
// backend schema accept null. This strips "" back to undefined before coercion runs, so
// blank genuinely means "not set" again.
const optionalNumber = (schema: z.ZodNumber) => z.preprocess((val) => (val === '' ? undefined : val), schema.optional());

const couponFormSchema = z
  .object({
    code: z.string().min(1, 'Required'),
    type: z.enum(['FLAT', 'PERCENT', 'BIRTHDAY']),
    value: z.coerce.number({ invalid_type_error: 'Required' }).positive('Must be greater than 0'),
    minOrder: optionalNumber(z.coerce.number().min(0)),
    maxUses: optionalNumber(z.coerce.number().int().positive('Must be a whole number greater than 0')),
    // .positive(), matching the backend exactly (not .min(0)) — 0 is meaningless as a
    // discount cap, and this way an admin who explicitly types 0 gets a clear inline
    // field error instead of the generic top-level "Invalid input" banner.
    maxDiscount: optionalNumber(z.coerce.number().positive('Must be greater than 0')),
    expiresAt: z.string().optional(), // yyyy-mm-dd from <input type="date">, converted to ISO on submit
  })
  .superRefine((data, ctx) => {
    if ((data.type === 'PERCENT' || data.type === 'BIRTHDAY') && data.value > 100) {
      ctx.addIssue({ path: ['value'], code: z.ZodIssueCode.custom, message: 'Percent must be 100 or less' });
    }
  });

type CouponFormShape = z.infer<typeof couponFormSchema>;

function couponToFormDefaults(coupon?: Coupon): Partial<CouponFormShape> {
  if (!coupon) return { type: 'FLAT' };
  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minOrder: coupon.minOrder ?? undefined,
    maxUses: coupon.maxUses ?? undefined,
    maxDiscount: coupon.maxDiscount ?? undefined,
    expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : undefined,
  };
}

export function CouponForm({
  coupon,
  onSubmit,
  submitLabel,
  submitting,
}: {
  coupon?: Coupon;
  onSubmit: (values: CreateCouponInput | UpdateCouponInput) => void;
  submitLabel: string;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CouponFormShape>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: couponToFormDefaults(coupon),
  });

  // Re-seed the form whenever a different coupon is passed in (drawer reused
  // across create/edit without unmounting), same pattern as OfferForm.
  useEffect(() => {
    reset(couponToFormDefaults(coupon));
  }, [coupon, reset]);

  const type = watch('type');
  const showMaxDiscount = type === 'PERCENT' || type === 'BIRTHDAY';
  const valueLabel = type === 'FLAT' ? 'Discount Amount (₹)' : 'Discount %';

  function submit(values: CouponFormShape) {
    onSubmit({
      code: values.code.trim().toUpperCase(),
      type: values.type,
      value: values.value,
      minOrder: values.minOrder ?? null,
      maxUses: values.maxUses ?? null,
      maxDiscount: values.maxDiscount ?? null,
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Code</label>
        <input {...register('code')} placeholder="e.g. WELCOME100" className={`${inputClass} uppercase placeholder:normal-case`} />
        {errors.code && <p className="text-xs text-red-600 mt-1">{errors.code.message}</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-2 block">Type</label>
        <div className="flex flex-col gap-2">
          {COUPON_TYPES.map((t) => (
            <label
              key={t.value}
              className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                type === t.value ? 'border-[#9C5A26] bg-[#9C5A26]/5' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" value={t.value} {...register('type')} className="w-4 h-4 accent-[#9C5A26]" />
                <span className="text-sm font-semibold text-slate-800">{t.label}</span>
              </span>
              <span className="text-[11px] text-slate-400 pl-6">{t.helper}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">{valueLabel}</label>
          <input type="number" min={0} max={type === 'FLAT' ? undefined : 100} step={1} {...register('value')} className={inputClass} />
          {errors.value && <p className="text-xs text-red-600 mt-1">{errors.value.message}</p>}
        </div>
        {showMaxDiscount && (
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              Max Discount (₹) <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input type="number" min={0} step={1} {...register('maxDiscount')} className={inputClass} />
            {errors.maxDiscount && <p className="text-xs text-red-600 mt-1">{errors.maxDiscount.message}</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">
            Min Order (₹) <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input type="number" min={0} step={1} {...register('minOrder')} className={inputClass} />
          {errors.minOrder && <p className="text-xs text-red-600 mt-1">{errors.minOrder.message}</p>}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">
            Max Uses <span className="text-slate-400 font-normal">(optional — blank = unlimited)</span>
          </label>
          <input type="number" min={1} step={1} placeholder="Unlimited" {...register('maxUses')} className={inputClass} />
          {errors.maxUses && <p className="text-xs text-red-600 mt-1">{errors.maxUses.message}</p>}
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">
          Expires At <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input type="date" {...register('expiresAt')} className={`${inputClass} max-w-[200px]`} />
        {errors.expiresAt && <p className="text-xs text-red-600 mt-1">{errors.expiresAt.message}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 bg-[#9C5A26] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#6B3D19] transition-colors disabled:opacity-50"
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
