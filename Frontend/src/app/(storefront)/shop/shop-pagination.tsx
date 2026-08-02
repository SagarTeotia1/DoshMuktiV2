'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ShopPagination({ page, pages }: { page: number; pages: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (pages <= 1) return null;

  function goTo(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete('page');
    else params.set('page', String(target));
    router.push(`/shop?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === pages || Math.abs(n - page) <= 1
  );

  return (
    <nav className="flex items-center justify-center gap-1.5 mt-10 sm:mt-14" aria-label="Pagination">
      <button
        onClick={() => goTo(page - 1)}
        disabled={page <= 1}
        className="w-9 h-9 rounded-full border border-[#2B1B0C] flex items-center justify-center hover:bg-[#F6E4C2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - nums[i - 1]! > 1 && <span className="font-body text-xs text-[#8A7A63] px-1">…</span>}
          <button
            onClick={() => goTo(n)}
            className={`w-9 h-9 rounded-full border font-body text-xs font-bold transition-all duration-200 ${
              n === page ? 'bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C]' : 'border-[#2B1B0C]/20 text-[#6B5539] hover:border-[#2B1B0C]'
            }`}
          >
            {n}
          </button>
        </span>
      ))}

      <button
        onClick={() => goTo(page + 1)}
        disabled={page >= pages}
        className="w-9 h-9 rounded-full border border-[#2B1B0C] flex items-center justify-center hover:bg-[#F6E4C2] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
