'use client';

import { useCoupons } from '@/hooks/use-coupons';
import type { RewardFieldsProps } from './offer-form-schema';
import { inputClass } from './reward-fields/shared';

function optionLabel(coupon: { code: string; type: string; value: number }): string {
  const amount = coupon.type === 'FLAT' ? `₹${coupon.value} off` : `${coupon.value}% off`;
  return `${coupon.code} — ${amount}`;
}

// Coupon catalogs are small enough (same precedent as ProductScopePicker's
// admin-facing cap) that a single-page select is sufficient — no need for a
// paginated/searchable list. Only active coupons are offered here: linking
// an archived coupon to a new offer would create an offer nobody can redeem.
export function CouponPicker({ register, errors }: RewardFieldsProps) {
  const { data, isLoading } = useCoupons({ status: 'active', pageSize: 100 });
  const coupons = data?.coupons ?? [];

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">Coupon</label>
      <select {...register('couponId')} className={inputClass} disabled={isLoading}>
        <option value="">{isLoading ? 'Loading coupons...' : 'Select a coupon...'}</option>
        {coupons.map((c) => (
          <option key={c.id} value={c.id}>
            {optionLabel(c)}
          </option>
        ))}
      </select>
      {errors.couponId && <p className="text-xs text-red-600 mt-1">{errors.couponId.message}</p>}
      {!isLoading && coupons.length === 0 && (
        <p className="text-[11px] text-slate-400 mt-1">No active coupons yet — create one from the Coupons page first.</p>
      )}
    </div>
  );
}
