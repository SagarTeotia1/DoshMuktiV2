'use client';

import type { RewardFieldsProps } from '../offer-form-schema';
import { inputClass } from './shared';

export function DisplayMessageFields({ register, errors }: RewardFieldsProps) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">Banner Text</label>
      <input {...register('bannerText')} placeholder="e.g. Blessed on a Full Moon Night" className={inputClass} />
      {errors.bannerText && <p className="text-xs text-red-600 mt-1">{errors.bannerText.message}</p>}
    </div>
  );
}
