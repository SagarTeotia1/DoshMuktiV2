import Link from 'next/link';
import { Heart, TrendingUp, Leaf, Trophy, Shield, Sparkles } from 'lucide-react';
import { PURPOSES } from '@/lib/constants';

const ICONS = {
  love: Heart,
  wealth: TrendingUp,
  health: Leaf,
  success: Trophy,
  protection: Shield,
  clarity: Sparkles,
} as const;

const TINTS: Record<string, string> = {
  love: 'rgba(244,63,94,0.04)',
  wealth: 'rgba(156,90,38,0.06)',
  health: 'rgba(34,197,94,0.04)',
  success: 'rgba(59,130,246,0.04)',
  protection: 'rgba(168,85,247,0.05)',
  clarity: 'rgba(99,102,241,0.04)',
};

function DecorativeCircle() {
  return (
    <svg className="absolute bottom-3 right-3 w-20 h-20 sm:w-28 sm:h-28 pointer-events-none select-none" viewBox="0 0 112 112" fill="none" aria-hidden>
      <circle cx="56" cy="56" r="50" stroke="#2B1B0C" strokeOpacity="0.04" strokeWidth="1" />
      <circle cx="56" cy="56" r="38" stroke="#2B1B0C" strokeOpacity="0.03" strokeWidth="1" />
      <circle cx="56" cy="56" r="26" stroke="#2B1B0C" strokeOpacity="0.03" strokeWidth="1" />
      <circle cx="56" cy="56" r="4" fill="#9C5A26" fillOpacity="0.12" />
    </svg>
  );
}

export function PurposeGrid() {
  return (
    <section className="py-10 sm:py-14 md:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="mb-8 sm:mb-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
              What Do You Seek?
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase text-[#2B1B0C] leading-none">
              Shop by<br className="sm:hidden" /> Intention
            </h2>
          </div>
          <p className="font-body text-xs sm:text-sm text-[#8A7A63] max-w-xs leading-relaxed">
            Every product is curated for a specific purpose. Start with what calls to you.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 rounded-2xl overflow-hidden border-t border-l border-[#2B1B0C]">
          {PURPOSES.map((purpose, idx) => {
            const Icon = ICONS[purpose.id as keyof typeof ICONS];
            const tint = TINTS[purpose.id] ?? 'transparent';

            return (
              <Link
                key={purpose.id}
                href={`/shop?purpose=${purpose.id}`}
                className="group relative flex flex-col justify-between p-4 sm:p-7 md:p-8 min-h-[150px] sm:min-h-[200px] md:min-h-[220px] bg-[#FBF1DF] overflow-hidden transition-colors duration-300 border-b border-r border-[#2B1B0C]"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ backgroundColor: tint }} />
                <DecorativeCircle />
                <span className="absolute top-3 right-20 sm:right-24 font-heading font-black text-6xl sm:text-7xl text-[#2B1B0C]/[0.035] select-none pointer-events-none leading-none">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-lg border border-[#2B1B0C] flex items-center justify-center bg-white group-hover:bg-[#9C5A26] group-hover:border-[#9C5A26] transition-all duration-200 z-10">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-[#2B1B0C]" />
                </div>
                <div className="relative z-10 mt-auto">
                  <h3 className="font-heading font-black text-[11px] sm:text-sm md:text-base uppercase tracking-tight text-[#2B1B0C] mb-1 leading-tight">
                    {purpose.label}
                  </h3>
                  <p className="font-body text-[9px] sm:text-xs text-[#8A7A63] leading-relaxed mb-1.5 line-clamp-2">{purpose.description}</p>
                  <span className="inline-flex items-center gap-1 font-body text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[#9C5A26] group-hover:gap-2 transition-all duration-200">
                    Explore <span>→</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
