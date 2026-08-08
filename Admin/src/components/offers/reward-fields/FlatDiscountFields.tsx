'use client';

import type { RewardFieldsProps } from '../offer-form-schema';
import { inputClass } from './shared';

export function FlatDiscountFields({ register, errors }: RewardFieldsProps) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">Discount Amount (₹)</label>
      <input type="number" min={0} step={1} {...register('amount')} className={`${inputClass} max-w-[180px]`} />
      {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>}
    </div>
  );
}
