'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Heart, TrendingUp, Leaf, Trophy, Shield, Sparkles, Gift, ChevronDown } from 'lucide-react';
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9C5A26] mb-2">{children}</p>;
}

function Tile({
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
    <button onClick={onClick} className="flex flex-col items-center gap-1 flex-shrink-0 w-12">
      <span
        className={`relative flex items-center justify-center w-10 h-10 rounded-full overflow-hidden transition-all duration-200 ${
          active ? 'ring-2 ring-[#9C5A26] ring-offset-2 ring-offset-[#FFFDF8]' : 'ring-1 ring-[#2B1B0C]/10'
        }`}
      >
        {thumb}
      </span>
      <span className={`text-[9px] font-medium text-center leading-tight ${active ? 'text-[#2B1B0C]' : 'text-[#8A7A63]'}`}>
        {label}
      </span>
    </button>
  );
}

const AllThumb = (active: boolean) => (
  <span
    className={`w-full h-full flex items-center justify-center ${active ? 'bg-gradient-to-br from-[#C9863F] to-[#6B3D19]' : 'bg-[#F6E4C2]'}`}
  >
    <span className={`text-[8px] font-bold uppercase ${active ? 'text-white' : 'text-[#6B5539]'}`}>All</span>
  </span>
);

export function ShopFiltersMobile({ categories }: { categories: CategoryThumb[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePurpose = searchParams.get('purpose');
  const activeCategory = searchParams.get('category');
  const [purposeOpen, setPurposeOpen] = useState(false);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <div className="lg:hidden mb-4">
      {categories.length > 0 && (
        <div>
          <SectionLabel>Shop by Category</SectionLabel>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar py-1">
            <Tile label="All" active={!activeCategory} onClick={() => setParam('category', null)} thumb={AllThumb(!activeCategory)} />
            {categories.map((c) => (
              <Tile
                key={c.id}
                label={c.label}
                active={activeCategory === c.id}
                onClick={() => setParam('category', c.id)}
                thumb={
                  c.image ? (
                    <Image src={c.image} alt="" fill className="object-cover" sizes="40px" />
                  ) : (
                    <span className="w-full h-full bg-[#F6E4C2] block" />
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className={categories.length > 0 ? 'mt-3 pt-3 border-t border-[#2B1B0C]/8' : ''}>
        <button type="button" onClick={() => setPurposeOpen((v) => !v)} className="flex items-center gap-1.5 w-full">
          <span className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9C5A26]">
            Shop by Purpose {activePurpose && `· ${PURPOSES.find((p) => p.id === activePurpose)?.label.split(' & ')[0]}`}
          </span>
          <ChevronDown className={`w-3 h-3 text-[#8A7A63] transition-transform duration-200 ${purposeOpen ? 'rotate-180' : ''}`} />
        </button>

        {purposeOpen && (
          <div className="flex gap-3 overflow-x-auto hide-scrollbar py-1 mt-2">
            {PURPOSES.map((p) => {
              const Icon = ICONS[p.id as keyof typeof ICONS];
              const [light, base] = GRADIENTS[p.id] ?? ['#C9863F', '#9C5A26'];
              return (
                <Tile
                  key={p.id}
                  label={p.label.split(' & ')[0]!}
                  active={activePurpose === p.id}
                  onClick={() => setParam('purpose', activePurpose === p.id ? null : p.id)}
                  thumb={
                    <span
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `radial-gradient(circle at 32% 28%, ${light}, ${base})` }}
                    >
                      <Icon className="w-4 h-4 text-white/95" strokeWidth={1.5} />
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
