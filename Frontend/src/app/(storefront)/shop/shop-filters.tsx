'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PURPOSES, PRODUCT_SORTS } from '@/lib/constants';

function FilterRow({
  label,
  active,
  options,
  onSelect,
}: {
  label: string;
  active: string | null;
  options: { id: string; label: string }[];
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <span className="flex-shrink-0 font-body text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A7A63] sm:w-24">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-wider font-body transition-all duration-200 flex-shrink-0 ${
            !active ? 'bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C]' : 'border-[#2B1B0C]/20 text-[#6B5539] hover:border-[#2B1B0C]'
          }`}
        >
          All
        </button>
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-wider font-body transition-all duration-200 flex-shrink-0 ${
              active === o.id ? 'bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C]' : 'border-[#2B1B0C]/20 text-[#6B5539] hover:border-[#2B1B0C]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShopFilters({ categories }: { categories: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePurpose = searchParams.get('purpose');
  const activeCategory = searchParams.get('category');
  const activeSort = searchParams.get('sort') ?? 'newest';

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/shop?${params.toString()}`);
  }

  const categoryOptions = categories.map((c) => ({ id: c, label: c }));

  return (
    <div className="bg-white border border-[#2B1B0C] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 mb-6 sm:mb-8">
      <FilterRow
        label="Intention"
        active={activePurpose}
        options={PURPOSES.map((p) => ({ id: p.id, label: p.label }))}
        onSelect={(v) => setParam('purpose', v)}
      />

      {categoryOptions.length > 0 && (
        <>
          <div className="h-px bg-[#2B1B0C]/8" />
          <FilterRow label="Category" active={activeCategory} options={categoryOptions} onSelect={(v) => setParam('category', v)} />
        </>
      )}

      <div className="h-px bg-[#2B1B0C]/8" />

      <div className="flex items-center justify-between sm:justify-end gap-3">
        <span className="sm:hidden font-body text-[9px] font-bold uppercase tracking-[0.2em] text-[#8A7A63]">Sort</span>
        <select
          value={activeSort}
          onChange={(e) => setParam('sort', e.target.value)}
          className="bg-[#FBF1DF] border border-[#2B1B0C]/30 rounded-full px-4 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider font-body focus:ring-2 focus:ring-[#9C5A26] focus:outline-none flex-shrink-0"
        >
          {PRODUCT_SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
