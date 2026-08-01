'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PURPOSES, PRODUCT_SORTS } from '@/lib/constants';

export function ShopFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePurpose = searchParams.get('purpose');
  const activeSort = searchParams.get('sort') ?? 'newest';

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setParam('purpose', null)}
          className={`px-3.5 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-wider font-body transition-all duration-200 ${
            !activePurpose ? 'bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C]' : 'border-[#2B1B0C]/20 text-[#6B5539] hover:border-[#2B1B0C]'
          }`}
        >
          All
        </button>
        {PURPOSES.map((p) => (
          <button
            key={p.id}
            onClick={() => setParam('purpose', p.id)}
            className={`px-3.5 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-wider font-body transition-all duration-200 ${
              activePurpose === p.id ? 'bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C]' : 'border-[#2B1B0C]/20 text-[#6B5539] hover:border-[#2B1B0C]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <select
        value={activeSort}
        onChange={(e) => setParam('sort', e.target.value)}
        className="bg-white border border-[#2B1B0C] rounded-lg px-3 py-2 text-xs font-body focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
      >
        {PRODUCT_SORTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
