'use client';

import Link from 'next/link';
import { PURPOSES } from '@/lib/constants';
import { PURPOSE_ICONS, PURPOSE_GRADIENTS } from '@/lib/purpose-style';
import { MULANK_PICKS, RASHI_PICKS } from '@/lib/bracelet-picks';

// Shared by the main nav drawer and the shop's category drawer.

// Zodiac glyphs are tinted by element so the grid scans at a glance.
const ELEMENT_COLOR: Record<string, string> = {
  Aries: '#B8502A', Leo: '#B8502A', Sagittarius: '#B8502A', // fire
  Taurus: '#5E8450', Virgo: '#5E8450', Capricorn: '#5E8450', // earth
  Gemini: '#4F74A0', Libra: '#4F74A0', Aquarius: '#4F74A0', // air
  Cancer: '#2F7C8A', Scorpio: '#2F7C8A', Pisces: '#2F7C8A', // water
};

export const DRAWER_HAIRLINE = 'border-[#2B1B0C]/15';

export function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 font-heading text-[15px] font-bold tracking-tight text-[#2B1B0C]">{title}</h3>
      {children}
    </section>
  );
}

/** A ruled grid: cells share hairlines instead of each being its own box. */
function RuledGrid({ cols, children }: { cols: 3 | 4; children: React.ReactNode }) {
  return (
    <ul
      className={`grid overflow-hidden rounded-xl border-l border-t bg-[#FBF1DB] ${DRAWER_HAIRLINE} ${
        cols === 3 ? 'grid-cols-3' : 'grid-cols-4'
      }`}
    >
      {children}
    </ul>
  );
}

const cell = `flex h-full flex-col items-center justify-center gap-1 border-b border-r px-1 py-3.5 text-center transition-colors active:bg-[#EBD6AD] ${DRAWER_HAIRLINE}`;

/** Shop by Mulank, Shop by Rashi, Shop by Purpose — in that order. `onNavigate` closes the host drawer. */
export function DrawerShopBy({ onNavigate }: { onNavigate: () => void }) {
  return (
    <>
      <DrawerSection title="Shop by Mulank">
        <RuledGrid cols={3}>
          {MULANK_PICKS.map((m) => (
            <li key={m.label}>
              <Link href={m.href} onClick={onNavigate} className={cell}>
                <span className="font-heading text-2xl font-bold leading-none text-[#2B1B0C]">{m.label}</span>
                <span className="font-body text-[11px] text-[#2B1B0C]/55">Mulank</span>
              </Link>
            </li>
          ))}
        </RuledGrid>
      </DrawerSection>

      <DrawerSection title="Shop by Rashi">
        <RuledGrid cols={3}>
          {RASHI_PICKS.map((r) => (
            <li key={r.name}>
              <Link href={r.href} onClick={onNavigate} className={cell}>
                <span aria-hidden className="text-2xl leading-none" style={{ color: ELEMENT_COLOR[r.name] ?? '#9C5A26' }}>
                  {r.glyph}
                </span>
                <span className="font-body text-[11px] font-medium text-[#2B1B0C]">{r.name}</span>
              </Link>
            </li>
          ))}
        </RuledGrid>
      </DrawerSection>

      <DrawerSection title="Shop by Purpose">
        <RuledGrid cols={4}>
          {PURPOSES.map((p, i) => {
            const Icon = PURPOSE_ICONS[p.id as keyof typeof PURPOSE_ICONS];
            const [light, base] = PURPOSE_GRADIENTS[p.id] ?? ['#C9863F', '#9C5A26'];
            // 7 purposes in 4 columns: the last one spans two cells so the grid has no hole.
            const wide = i === PURPOSES.length - 1 && PURPOSES.length % 4 === 3;
            return (
              <li key={p.id} className={wide ? 'col-span-2' : undefined}>
                <Link href={`/shop?purpose=${p.id}`} onClick={onNavigate} className={cell}>
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ background: `linear-gradient(135deg, ${light}, ${base})` }}
                  >
                    <Icon className="h-[18px] w-[18px] text-white" strokeWidth={1.75} />
                  </span>
                  <span className="font-body text-[11px] font-medium text-[#2B1B0C]">{p.label.split(' & ')[0]}</span>
                </Link>
              </li>
            );
          })}
        </RuledGrid>
      </DrawerSection>
    </>
  );
}
