'use client';

import type { RewardFieldsProps } from '../offer-form-schema';
import { inputClass } from './shared';

export function PercentageDiscountFields({ register, errors }: RewardFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Discount %</label>
        <input type="number" min={0} max={100} step={1} {...register('percent')} className={inputClass} />
        {errors.percent && <p className="text-xs text-red-600 mt-1">{errors.percent.message}</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">
          Maximum Discount (₹) <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input type="number" min={0} step={1} {...register('maxDiscount')} className={inputClass} />
      </div>
    </div>
  );
}
