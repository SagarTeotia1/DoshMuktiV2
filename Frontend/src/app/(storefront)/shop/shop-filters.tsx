'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Heart, TrendingUp, Leaf, Trophy, Shield, Sparkles, Gift, SlidersHorizontal } from 'lucide-react';
import { PURPOSES } from '@/lib/constants';

const ICONS = {
  love: Heart,
  wealth: TrendingUp,
  health: Leaf,
  success: Trophy,
  protection: Shield,
  clarity: Sparkles,
  gifting: Gift,
} as const;

const GRADIENTS: Record<string, [string, string]> = {
  love: ['#C97B63', '#8C4A36'],
  wealth: ['#D4A64A', '#9C5A26'],
  health: ['#8FA876', '#5C7245'],
  success: ['#D4B24C', '#96731E'],
  protection: ['#8570A6', '#5A4A78'],
  clarity: ['#7FA3A0', '#4E6E6B'],
  gifting: ['#C98F82', '#8C5648'],
};

interface CategoryThumb {
  id: string;
  label: string;
  image: string | null;
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-5 mb-5 border-b border-[#2B1B0C]/8 last:border-b-0 last:pb-0 last:mb-0">
      <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9C5A26] mb-3">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function FilterRow({
  thumb,
  label,
  active,
  onClick,
}: {
  thumb: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 transition-colors duration-150 ${
        active ? 'bg-gradient-to-r from-[#6B3D19] to-[#9C5A26]' : 'hover:bg-[#F6E4C2]/60'
      }`}
    >
      <span
        className={`relative w-8 h-8 flex-shrink-0 rounded-full overflow-hidden transition-all duration-200 ${
          active ? 'ring-2 ring-[#E6D3AE] ring-offset-1 ring-offset-[#9C5A26]' : 'ring-1 ring-[#2B1B0C]/10 group-hover:ring-[#9C5A26]/50'
        }`}
      >
        {thumb}
      </span>
      <span
        className={`font-body text-[13px] font-medium text-left leading-tight ${
          active ? 'text-[#E6D3AE]' : 'text-[#6B5539] group-hover:text-[#2B1B0C]'
        }`}
      >
        {label}
      </span>
    </button>
  );
}

const AllThumb = (
  <span className="w-full h-full bg-gradient-to-br from-[#C9863F] to-[#6B3D19] flex items-center justify-center">
    <span className="text-[8px] font-bold text-white uppercase">All</span>
  </span>
);

export function ShopFilters({ categories }: { categories: CategoryThumb[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePurpose = searchParams.get('purpose');
  const activeCategory = searchParams.get('category');

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <aside className="w-full rounded-2xl bg-[#F6E4C2]/35 border border-[#2B1B0C]/8 p-4">
      <div className="hidden lg:flex items-center gap-1.5 mb-4">
        <SlidersHorizontal className="w-3.5 h-3.5 text-[#2B1B0C]/70" strokeWidth={2} />
        <p className="font-body text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2B1B0C]">Filter</p>
      </div>

      {categories.length > 0 && (
        <FilterSection title="Category">
          <FilterRow label="All" active={!activeCategory} onClick={() => setParam('category', null)} thumb={AllThumb} />
          {categories.map((c) => (
            <FilterRow
              key={c.id}
              label={c.label}
              active={activeCategory === c.id}
              onClick={() => setParam('category', c.id)}
              thumb={
                c.image ? (
                  <Image src={c.image} alt="" fill className="object-cover" sizes="32px" />
                ) : (
                  <span className="w-full h-full bg-[#F6E4C2] block" />
                )
              }
            />
          ))}
        </FilterSection>
      )}

      <FilterSection title="Purpose">
        {PURPOSES.map((p) => {
          const Icon = ICONS[p.id as keyof typeof ICONS];
          const [light, base] = GRADIENTS[p.id] ?? ['#C9863F', '#9C5A26'];
          return (
            <FilterRow
              key={p.id}
              label={p.label.split(' & ')[0]!}
              active={activePurpose === p.id}
              onClick={() => setParam('purpose', activePurpose === p.id ? null : p.id)}
              thumb={
                <span
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: `radial-gradient(circle at 32% 28%, ${light}, ${base})` }}
                >
                  <Icon className="w-3.5 h-3.5 text-white/95" strokeWidth={1.5} />
                </span>
              }
            />
          );
        })}
      </FilterSection>
    </aside>
  );
}
