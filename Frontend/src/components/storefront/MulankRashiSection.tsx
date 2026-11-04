import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { RASHI_PICKS } from '@/lib/bracelet-picks';

const GOLD = '#E8A850';
const BRONZE = '#C9863F';

const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: 100 + Math.cos(a) * r, y: 100 + Math.sin(a) * r };
};

/** Shared yantra rings: two thin circles and a tick ring. */
function Rings() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <g fill="none">
      <circle cx="100" cy="100" r="97" stroke={GOLD} strokeWidth="1.2" />
      <circle cx="100" cy="100" r="74" stroke={BRONZE} strokeWidth="0.8" opacity="0.8" />
      {ticks.map((deg) => {
        const a = polar(deg, 97);
        const b = polar(deg, deg % 15 === 0 ? 91 : 94);
        return <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BRONZE} strokeWidth="0.7" opacity="0.7" />;
      })}
    </g>
  );
}

/** Slowly turning sacred-geometry star: three squares rotated 30 degrees apart (stops for reduced motion). */
function TurningStar() {
  return (
    <g
      fill="none"
      stroke={BRONZE}
      strokeWidth="0.8"
      opacity="0.75"
      className="origin-center [transform-box:fill-box] animate-[spin_80s_linear_infinite] motion-reduce:animate-none"
    >
      {[0, 30, 60].map((rot) => (
        <rect key={rot} x="46" y="46" width="108" height="108" transform={`rotate(${rot} 100 100)`} />
      ))}
    </g>
  );
}

/** Mulank: numbers 1-9 around the ring, the Lo Shu numerology grid at the centre. */
function MulankYantra() {
  const grid = [
    [4, 9, 2],
    [3, 5, 7],
    [8, 1, 6],
  ];
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <Rings />
      <TurningStar />
      <g fill={BRONZE} fontSize="9" fontWeight="700" textAnchor="middle" dominantBaseline="central" opacity="0.9">
        {Array.from({ length: 9 }, (_, i) => {
          const p = polar(i * 40, 84);
          return (
            <text key={i} x={p.x} y={p.y}>
              {i + 1}
            </text>
          );
        })}
      </g>
      <path d="M82 62v76M118 62v76M62 82h76M62 118h76" stroke={BRONZE} strokeWidth="0.8" opacity="0.7" />
      <g fill={GOLD} fontSize="20" fontWeight="800" textAnchor="middle" dominantBaseline="central">
        {grid.map((row, r) =>
          row.map((n, c) => (
            <text key={`${r}-${c}`} x={72 + c * 28} y={72 + r * 28}>
              {n}
            </text>
          )),
        )}
      </g>
    </svg>
  );
}

/** Rashi: the twelve zodiac glyphs around the ring, a sun at the centre. */
function RashiYantra() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
      <Rings />
      <TurningStar />
      <g fill={GOLD} fontSize="13" textAnchor="middle" dominantBaseline="central">
        {RASHI_PICKS.map((r, i) => {
          const p = polar(i * 30, 84);
          return (
            <text key={r.name} x={p.x} y={p.y}>
              {r.glyph}
            </text>
          );
        })}
      </g>
      <circle cx="100" cy="100" r="22" fill="none" stroke={GOLD} strokeWidth="1.2" />
      <circle cx="100" cy="100" r="9" fill={GOLD} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = polar(i * 30, 26);
        const b = polar(i * 30, 34);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={GOLD} strokeWidth="1.2" />;
      })}
    </svg>
  );
}

const TILES = [
  {
    category: 'Mulank Bracelets',
    title: 'Shop by Mulank',
    sub: 'Made for your birth number',
    Yantra: MulankYantra,
  },
  {
    category: 'Rashi Collections',
    title: 'Shop by Rashi',
    sub: 'Made for your zodiac sign',
    Yantra: RashiYantra,
  },
] as const;

/** Homepage "find your bracelet" entry points: two temple-niche arches, each holding its own yantra. */
export function MulankRashiSection() {
  return (
    <section className="relative overflow-hidden pb-6 pt-2 sm:pb-10 sm:pt-3">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[60%] w-[min(40rem,100%)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(closest-side, rgba(255,253,248,0.5), rgba(255,253,248,0))' }}
        aria-hidden
      />
      <MandalaMotif className="pointer-events-none absolute -left-24 top-8 h-72 w-72 text-[#9C5A26]/[0.07]" />
      <MandalaMotif className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 text-[#9C5A26]/[0.07]" />

      <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-12">
        <div className="mb-4 text-center sm:mb-6">
          <h2 className="font-heading text-2xl leading-[1.1] tracking-tight text-[#2B1B0C] sm:text-3xl md:text-4xl">
            <span className="font-black">Find Your</span>{' '}
            <span className="font-light italic text-[#9C5A26]">Bracelet</span>
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs font-body text-xs text-[#5C4A33] sm:max-w-md sm:text-sm">
            Choose by your birth number or your zodiac sign.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6">
          {TILES.map(({ category, title, sub, Yantra }) => (
            <Link
              key={category}
              href={`/shop?category=${encodeURIComponent(category)}`}
              className="group relative flex flex-col items-center overflow-hidden rounded-t-full rounded-b-2xl border-2 border-[#2B1B0C] bg-gradient-to-b from-[#3A2612] to-[#2B1B0C] px-3 pb-3 pt-4 text-center text-[#E6D3AE] shadow-neo-lg transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9C5A26] sm:px-6 sm:pb-5 sm:pt-7"
            >
              {/* glow behind the yantra */}
              <span
                className="pointer-events-none absolute left-1/2 top-[18%] h-3/5 w-3/5 -translate-x-1/2 rounded-full blur-2xl"
                style={{ background: 'rgba(232,168,80,0.22)' }}
                aria-hidden
              />
              <span className="relative block aspect-square w-[72%] max-w-[10.5rem] transition-transform duration-500 group-hover:scale-[1.04]">
                <Yantra />
              </span>

              <h3 className="relative mt-2 font-heading text-base font-black leading-tight tracking-tight sm:mt-3 sm:text-xl">
                {title}
              </h3>
              <p className="relative mt-0.5 font-body text-[10px] leading-snug text-[#E6D3AE]/75 sm:text-xs">{sub}</p>
              <span className="relative mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#E8A850] px-4 py-2 font-body text-xs font-bold text-[#2B1B0C] transition-colors group-hover:bg-[#E6D3AE] sm:w-auto sm:px-6">
                Shop now
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
