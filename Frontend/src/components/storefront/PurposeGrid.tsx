import Link from 'next/link';
import { Heart, TrendingUp, Leaf, Trophy, Shield, Sparkles, Gift, MoonStar } from 'lucide-react';
import { PURPOSES } from '@/lib/constants';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';

const ICONS = {
  love: Heart,
  wealth: TrendingUp,
  health: Leaf,
  success: Trophy,
  protection: Shield,
  clarity: Sparkles,
  gifting: Gift,
} as const;

/** Muted, bronze-adjacent duotones — desaturated so each purpose reads distinct without breaking the warm palette. */
const GRADIENTS: Record<string, [string, string]> = {
  love: ['#D98BA0', '#B8546B'],
  wealth: ['#C9863F', '#9C5A26'],
  health: ['#9CBF8C', '#6B8F5C'],
  success: ['#8CAAC9', '#5B7A9C'],
  protection: ['#B69BD1', '#8B6BAE'],
  clarity: ['#A6A6D1', '#7A7AAE'],
  gifting: ['#E0A9C4', '#B8698F'],
};

export function PurposeGrid() {
  return (
    <section className="relative bg-[#E6D3AE] py-4 sm:py-5 overflow-hidden">
      <MandalaMotif className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 sm:w-80 sm:h-80 text-[#9C5A26]/[0.05]" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="relative text-center mb-3 sm:mb-4">
          <h2 className="font-display font-bold tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C]">
            What Do You Seek?
          </h2>
          <span className="sticker brutal-border absolute -top-2 right-2 sm:right-8 hidden sm:inline-flex items-center gap-1 bg-[#F6E4C2] text-[#2B1B0C] px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide shadow-[3px_3px_0_0_#2B1B0C]">
            <MoonStar className="w-3 h-3" strokeWidth={2} />
            Energized
          </span>
        </div>

        <StaggerGroup className="grid grid-cols-3 justify-center sm:flex sm:justify-center sm:flex-wrap gap-y-4 gap-x-2 sm:gap-9 md:gap-11 sm:overflow-x-auto hide-scrollbar sm:snap-x sm:snap-mandatory px-1 py-1 place-items-center">
          {PURPOSES.map((purpose) => {
            const Icon = ICONS[purpose.id as keyof typeof ICONS];
            const [light, base] = GRADIENTS[purpose.id] ?? ['#C9863F', '#9C5A26'];
            const isGifting = purpose.id === 'gifting';

            return (
              <StaggerItem
                key={purpose.id}
                className={`snap-start ${isGifting ? 'hidden sm:block sm:flex-shrink-0' : 'flex-shrink-0'}`}
              >
                <Link href={`/shop?purpose=${purpose.id}`} className="group flex flex-col items-center gap-2 w-20 sm:w-24">
                  <span className="p-[3px] rounded-full border border-[#2B1B0C]/15 group-hover:border-[#9C5A26] transition-all duration-300 group-hover:-translate-y-1">
                    <span
                      className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-[inset_0_-4px_10px_rgba(0,0,0,0.18)]"
                      style={{ background: `radial-gradient(circle at 32% 28%, ${light}, ${base})` }}
                    >
                      <Icon className="w-7 h-7 sm:w-8 sm:h-8 text-white/95" strokeWidth={1.5} />
                    </span>
                  </span>
                  <span className="font-heading font-black text-[11px] sm:text-sm uppercase tracking-tight text-[#2B1B0C]/85 group-hover:text-[#9C5A26] transition-colors duration-300 text-center leading-tight">
                    {purpose.label.split(' & ')[0]}
                  </span>
                </Link>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}
