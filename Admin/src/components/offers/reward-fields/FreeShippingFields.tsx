'use client';

import type { RewardFieldsProps } from '../offer-form-schema';
import { inputClass } from './shared';

export function FreeShippingFields({ register }: RewardFieldsProps) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">
        Minimum Order Value (₹) <span className="text-slate-400 font-normal">(optional — leave blank for no minimum)</span>
      </label>
      <input type="number" min={0} step={1} {...register('minOrderValue')} className={`${inputClass} max-w-[180px]`} />
    </div>
  );
}
