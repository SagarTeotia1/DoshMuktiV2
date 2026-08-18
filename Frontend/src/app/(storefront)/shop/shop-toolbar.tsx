'use client';

import { SlidersHorizontal, ChevronDown, List, LayoutGrid } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PRODUCT_SORTS } from '@/lib/constants';

export function ShopToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSort = searchParams.get('sort') ?? 'newest';
  const activeView = searchParams.get('view') ?? 'grid';
  const sortLabel = PRODUCT_SORTS.find((s) => s.id === activeSort)?.label ?? PRODUCT_SORTS[0].label;

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.delete('page');
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between gap-3 pb-3 mb-5 border-b border-[#2B1B0C]/8">
      <div className="flex items-center gap-1.5 lg:hidden">
        <span className="font-body font-semibold text-xs uppercase tracking-wide text-[#2B1B0C]">Filter</span>
        <SlidersHorizontal className="w-3.5 h-3.5 text-[#2B1B0C]/70" strokeWidth={2} />
      </div>

      <div className="hidden lg:block relative">
        <div className="flex items-center gap-1.5 px-1 py-1 cursor-pointer">
          <span className="font-body text-xs font-medium text-[#8A7A63]">Sort by</span>
          <span className="font-body text-xs font-semibold text-[#2B1B0C] flex items-center gap-1">
            {sortLabel}
            <ChevronDown className="w-3 h-3 text-[#8A7A63]" strokeWidth={2} />
          </span>
        </div>
        <select
          value={activeSort}
          onChange={(e) => setParam('sort', e.target.value)}
          aria-label="Sort products"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        >
          {PRODUCT_SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <span className="font-body text-xs font-medium text-[#8A7A63] hidden sm:inline">View</span>
        <div className="flex items-center gap-1 bg-[#F6E4C2]/50 rounded-full p-0.5">
          <button
            type="button"
            onClick={() => setParam('view', 'list')}
            aria-label="List view"
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-150 ${
              activeView === 'list' ? 'bg-gradient-to-r from-[#6B3D19] to-[#9C5A26] text-[#E6D3AE]' : 'text-[#8A7A63] hover:text-[#2B1B0C]'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setParam('view', 'grid')}
            aria-label="Grid view"
            className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors duration-150 ${
              activeView === 'grid' ? 'bg-gradient-to-r from-[#6B3D19] to-[#9C5A26] text-[#E6D3AE]' : 'text-[#8A7A63] hover:text-[#2B1B0C]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
