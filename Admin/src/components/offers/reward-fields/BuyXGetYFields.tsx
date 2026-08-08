'use client';

import { useProducts } from '@/hooks/use-products';
import type { RewardFieldsProps } from '../offer-form-schema';
import { inputClass } from './shared';

export function BuyXGetYFields({ register, errors }: RewardFieldsProps) {
  const { data } = useProducts('ACTIVE');

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Buy Quantity</label>
          <input type="number" min={1} step={1} {...register('buyQuantity')} className={inputClass} />
          {errors.buyQuantity && <p className="text-xs text-red-600 mt-1">{errors.buyQuantity.message}</p>}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Get Quantity</label>
          <input type="number" min={1} step={1} {...register('getQuantity')} className={inputClass} />
          {errors.getQuantity && <p className="text-xs text-red-600 mt-1">{errors.getQuantity.message}</p>}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">
          Get Product <span className="text-slate-400 font-normal">(optional — leave blank to mean "same product")</span>
        </label>
        <select {...register('getProductId')} className={inputClass}>
          <option value="">Same product</option>
          {data?.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[11px] text-slate-400">
        Note: Buy X Get Y is config-only today — there's no checkout processor for it yet. It's fully creatable/editable here for when that ships.
      </p>
    </div>
  );
}
