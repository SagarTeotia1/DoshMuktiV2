// Quick-pick links for the "shop by Mulank / Rashi" entry points (homepage section + nav drawer).
// Each links straight to that bracelet's product page.
export const MULANK_PICKS = Array.from({ length: 9 }, (_, i) => ({
  label: String(i + 1),
  name: `Mulank ${i + 1}`,
  href: `/products/mulank-${i + 1}-bracelet`,
}));

const RASHI_ROWS: Array<[glyph: string, name: string, slug: string]> = [
  ['♈︎', 'Aries', 'aries'],
  ['♉︎', 'Taurus', 'taurus'],
  ['♊︎', 'Gemini', 'gemini'],
  ['♋︎', 'Cancer', 'cancer'],
  ['♌︎', 'Leo', 'leo'],
  ['♍︎', 'Virgo', 'virgo'],
  ['♎︎', 'Libra', 'libra'],
  ['♏︎', 'Scorpio', 'scorpio'],
  ['♐︎', 'Sagittarius', 'sagittarius'],
  ['♑︎', 'Capricorn', 'capricorn'],
  ['♒︎', 'Aquarius', 'aquarius'],
  ['♓︎', 'Pisces', 'pisces'],
];

export const RASHI_PICKS = RASHI_ROWS.map(([glyph, name, slug]) => ({
  glyph,
  name,
  href: `/products/${slug}-zodiac-bracelet`,
}));
