// Deterministic numerology/sun-sign facts computed from a real DOB, fed into the LLM's
// context as ground truth so its "reading" is anchored to real numbers instead of
// hallucinated ones. This module does no LLM calls and has no side effects — pure math.

const ZODIAC_RANGES: Array<{ sign: string; endMonth: number; endDay: number }> = [
  { sign: 'Capricorn', endMonth: 1, endDay: 19 },
  { sign: 'Aquarius', endMonth: 2, endDay: 18 },
  { sign: 'Pisces', endMonth: 3, endDay: 20 },
  { sign: 'Aries', endMonth: 4, endDay: 19 },
  { sign: 'Taurus', endMonth: 5, endDay: 20 },
  { sign: 'Gemini', endMonth: 6, endDay: 20 },
  { sign: 'Cancer', endMonth: 7, endDay: 22 },
  { sign: 'Leo', endMonth: 8, endDay: 22 },
  { sign: 'Virgo', endMonth: 9, endDay: 22 },
  { sign: 'Libra', endMonth: 10, endDay: 22 },
  { sign: 'Scorpio', endMonth: 11, endDay: 21 },
  { sign: 'Sagittarius', endMonth: 12, endDay: 21 },
  { sign: 'Capricorn', endMonth: 12, endDay: 31 },
];

export function sunSignFromDob(dob: Date): string {
  const month = dob.getUTCMonth() + 1;
  const day = dob.getUTCDate();
  const match = ZODIAC_RANGES.find((r) => month === r.endMonth && day <= r.endDay) ??
    ZODIAC_RANGES.find((r) => month < r.endMonth) ??
    ZODIAC_RANGES[ZODIAC_RANGES.length - 1]!;
  return match.sign;
}

// Sum every digit of YYYYMMDD, reduce to a single digit — except master numbers 11/22/33,
// which numerology conventionally leaves un-reduced.
export function lifePathNumber(dob: Date): number {
  const digits = `${dob.getUTCFullYear()}${String(dob.getUTCMonth() + 1).padStart(2, '0')}${String(dob.getUTCDate()).padStart(2, '0')}`;
  let n = digits.split('').reduce((sum, d) => sum + Number(d), 0);
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n)
      .split('')
      .reduce((sum, d) => sum + Number(d), 0);
  }
  return n;
}

export function parseDob(raw: string): Date | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() < 1900 || d.getTime() > Date.now()) return null;
  return d;
}

export interface AstrologyFacts {
  sunSign: string;
  lifePath: number;
}

export function computeAstrologyFacts(dobIso: string): AstrologyFacts | null {
  const dob = parseDob(dobIso);
  if (!dob) return null;
  return { sunSign: sunSignFromDob(dob), lifePath: lifePathNumber(dob) };
}

// Approximate real ingress dates for the two slow-moving "life theme" planets astrology
// commonly credits for when a stretch of trouble/change began — genuinely dated events,
// not invented ones, but kept approximate ("~") since exact ingress can shift a few days
// with retrograde loops. Used only to give the reading a specific, real-world anchor
// ("since Jupiter moved into Leo around June") instead of vague generic timing.
export const RECENT_TRANSITS: Array<{ planet: 'Jupiter' | 'Saturn'; sign: string; approxDate: string }> = [
  { planet: 'Saturn', sign: 'Pisces', approxDate: '2023-03-07' },
  { planet: 'Jupiter', sign: 'Taurus', approxDate: '2023-05-16' },
  { planet: 'Jupiter', sign: 'Gemini', approxDate: '2024-05-25' },
  { planet: 'Saturn', sign: 'Aries', approxDate: '2025-05-24' },
  { planet: 'Jupiter', sign: 'Cancer', approxDate: '2025-06-09' },
  { planet: 'Jupiter', sign: 'Leo', approxDate: '2026-06-30' },
];

// Every transit within the last ~18 months, most recent first — a small enough window
// that "your trouble started around when X shifted" stays plausible rather than reaching
// for something years back.
export function recentTransits(asOf: Date = new Date()): typeof RECENT_TRANSITS {
  const cutoff = new Date(asOf);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 18);
  return RECENT_TRANSITS.filter((t) => new Date(t.approxDate) <= asOf && new Date(t.approxDate) >= cutoff).sort(
    (a, b) => new Date(b.approxDate).getTime() - new Date(a.approxDate).getTime()
  );
}
