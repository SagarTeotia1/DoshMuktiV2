'use client';

import type { RewardFieldsProps } from '../offer-form-schema';
import { inputClass } from './shared';

export function CashbackFields({ register, errors }: RewardFieldsProps) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">Cashback %</label>
      <input type="number" min={0} max={100} step={1} {...register('percent')} className={`${inputClass} max-w-[140px]`} />
      {errors.percent && <p className="text-xs text-red-600 mt-1">{errors.percent.message}</p>}
    </div>
  );
}
