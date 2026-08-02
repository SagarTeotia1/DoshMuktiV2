/** Hairline + center diamond — the light-background counterpart to MandalaMotif's
 * dark-background watermark. Used consistently between rails so the rhythm reads
 * as one system, not one-off decoration per section. */
export function SectionDivider() {
  return (
    <div className="flex items-center justify-center gap-3 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12" aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#9C5A26]/25" />
      <span className="w-2 h-2 rotate-45 border border-[#9C5A26]/40" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#9C5A26]/25" />
    </div>
  );
}
