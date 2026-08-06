'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Offer } from '@/types/api.types';
import {
  offerFormSchema,
  offerToFormDefaults,
  buildOfferConfig,
  OFFER_BEHAVIORS,
  OFFER_REWARDS,
  OFFER_SCOPES,
  type OfferFormShape,
} from './offer-form-schema';
import { REWARD_FIELD_COMPONENTS } from './reward-fields';
import { CouponPicker } from './CouponPicker';
import { ProductScopePicker } from './ProductScopePicker';
import { useCategories } from '@/hooks/use-categories';
import type { CreateOfferInput, UpdateOfferInput } from '@/hooks/use-offers';

const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

export function OfferForm({
  offer,
  onSubmit,
  submitLabel,
  submitting,
}: {
  offer?: Offer;
  onSubmit: (values: CreateOfferInput | UpdateOfferInput) => void;
  submitLabel: string;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<OfferFormShape>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: offerToFormDefaults(offer),
  });

  // Re-seed the form whenever a different offer is passed in (e.g. the
  // drawer is reused across "duplicate then edit new copy" without unmounting).
  useEffect(() => {
    reset(offerToFormDefaults(offer));
  }, [offer, reset]);

  const behavior = watch('behavior');
  const reward = watch('reward');
  const scope = watch('scope');
  const productIds = watch('productIds');

  const RewardFields = REWARD_FIELD_COMPONENTS[reward];
  const { data: categories } = useCategories();

  function submit(values: OfferFormShape) {
    const config = buildOfferConfig(values);
    onSubmit({
      title: values.title.trim(),
      behavior: values.behavior,
      reward: values.reward,
      config,
      couponId: values.behavior === 'COUPON_BASED' ? values.couponId!.trim() : null,
      scope: values.scope,
      category: values.scope === 'CATEGORY' ? values.category!.trim() : null,
      productIds: values.scope === 'SPECIFIC_PRODUCTS' ? values.productIds : [],
      // Cleared to null when behavior === COUPON_BASED even if a value was previously
      // typed in — the linked Coupon's own minOrder covers that case instead.
      minOrderValue: values.behavior === 'COUPON_BASED' ? null : values.conditionMinOrderValue ?? null,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Title</label>
        <input {...register('title')} placeholder="e.g. 100% Cashback on First Order" className={inputClass} />
        {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-2 block">1. Behavior — when does this offer activate?</label>
        <div className="flex flex-col gap-2">
          {OFFER_BEHAVIORS.map((b) => (
            <label
              key={b.value}
              className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                behavior === b.value ? 'border-[#9C5A26] bg-[#9C5A26]/5' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" value={b.value} {...register('behavior')} className="w-4 h-4 accent-[#9C5A26]" />
                <span className="text-sm font-semibold text-slate-800">{b.label}</span>
              </span>
              <span className="text-[11px] text-slate-400 pl-6">{b.helper}</span>
            </label>
          ))}
        </div>
      </div>

      {behavior === 'COUPON_BASED' ? (
        <>
          <CouponPicker register={register} errors={errors} />
          <p className="text-[11px] text-slate-400 -mt-3">This coupon's own minimum order requirement applies instead.</p>
        </>
      ) : (
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">
            Minimum Cart Value (₹, optional)
          </label>
          <input type="number" min={0} step={1} {...register('conditionMinOrderValue')} className={`${inputClass} max-w-[180px]`} />
          {errors.conditionMinOrderValue && <p className="text-xs text-red-600 mt-1">{errors.conditionMinOrderValue.message}</p>}
          <p className="text-[11px] text-slate-400 mt-1">
            For Auto Applied offers, the reward only activates once the cart reaches this amount. For Display Only, this is just shown as a
            condition.
          </p>
        </div>
      )}

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-2 block">2. Scope — who does this apply to?</label>
        <div className="flex flex-col gap-2">
          {OFFER_SCOPES.map((s) => (
            <label
              key={s.value}
              className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                scope === s.value ? 'border-[#9C5A26] bg-[#9C5A26]/5' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <input type="radio" value={s.value} {...register('scope')} className="w-4 h-4 accent-[#9C5A26]" />
                <span className="text-sm font-semibold text-slate-800">{s.label}</span>
              </span>
              <span className="text-[11px] text-slate-400 pl-6">{s.helper}</span>
            </label>
          ))}
        </div>

        {scope === 'SPECIFIC_PRODUCTS' && (
          <div className="mt-3">
            <ProductScopePicker selectedIds={productIds ?? []} onChange={(ids) => setValue('productIds', ids)} />
          </div>
        )}

        {scope === 'CATEGORY' && (
          <div className="mt-3">
            <select {...register('category')} className={inputClass}>
              <option value="">Select category...</option>
              {categories?.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-red-600 mt-1">{errors.category.message}</p>}
          </div>
        )}

        {scope === 'ALL_PRODUCTS' && (
          <p className="mt-3 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
            Applies automatically to every active product store-wide — no picker needed.
          </p>
        )}
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-2 block">3. Reward — what does the customer get?</label>
        <select {...register('reward')} className={inputClass}>
          {OFFER_REWARDS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-600 mb-2 block">4. Reward details</label>
        <RewardFields register={register} errors={errors} />
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
