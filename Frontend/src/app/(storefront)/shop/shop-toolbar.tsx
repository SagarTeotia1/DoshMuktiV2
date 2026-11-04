'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PRODUCT_SORTS } from '@/lib/constants';
import { ShopCategoryDrawer } from './shop-category-drawer';

export function ShopToolbar({
  total,
  categories,
}: {
  total: number;
  categories: Array<{ id: string; label: string; image: string | null }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSort = searchParams.get('sort') ?? 'newest';

  function setSort(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    params.delete('page');
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#2B1B0C]/15 pb-3">
      <div className="flex items-center gap-3">
        <ShopCategoryDrawer categories={categories} />
        <p className="font-body text-xs text-[#6B5539] sm:text-sm">
          <span className="font-bold text-[#2B1B0C]">{total}</span> {total === 1 ? 'piece' : 'pieces'}
        </p>
      </div>

      {/* Sort: visible on every screen size; the native select sits invisibly over the styled pill. */}
      <div className="relative">
        <div className="flex items-center gap-1.5 rounded-full border border-[#2B1B0C]/25 bg-[#FFFDF8] py-1.5 pl-3 pr-2.5">
          <span className="font-body text-xs font-semibold text-[#2B1B0C]">
            {PRODUCT_SORTS.find((s) => s.id === activeSort)?.label ?? PRODUCT_SORTS[0].label}
          </span>
          <ChevronDown className="h-3 w-3 text-[#6B5539]" strokeWidth={2.25} />
        </div>
        <select
          value={activeSort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort products"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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
