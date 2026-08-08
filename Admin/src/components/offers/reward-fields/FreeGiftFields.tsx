'use client';

import { useProducts } from '@/hooks/use-products';
import type { RewardFieldsProps } from '../offer-form-schema';
import { inputClass } from './shared';

export function FreeGiftFields({ register, errors }: RewardFieldsProps) {
  const { data } = useProducts('ACTIVE');

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">Free Gift Product</label>
      <select {...register('freeGiftProductId')} className={inputClass}>
        <option value="">Select product...</option>
        {data?.products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {errors.freeGiftProductId && <p className="text-xs text-red-600 mt-1">{errors.freeGiftProductId.message}</p>}
    </div>
  );
}
