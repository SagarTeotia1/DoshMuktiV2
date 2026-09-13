// Suspense fallback for <ProductRail> while its related-products fetch streams in —
// same header + horizontal-card shape as the real rail so nothing jumps when it swaps in.
export function ProductRailSkeleton({ tinted, tightTop, tightBottom }: { tinted?: boolean; tightTop?: boolean; tightBottom?: boolean }) {
  return (
    <section
      className={`relative overflow-hidden ${tightTop ? 'pt-6 sm:pt-8' : 'pt-10 sm:pt-14 md:pt-20'} ${tightBottom ? 'pb-6 sm:pb-8' : 'pb-10 sm:pb-14 md:pb-20'} ${tinted ? 'bg-[#F6E4C2]/50' : ''}`}
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="h-9 sm:h-11 w-56 sm:w-72 rounded-full bg-[#2B1B0C]/10 animate-pulse mb-8 sm:mb-12" />
      </div>
      <div className="flex gap-4 sm:gap-6 overflow-hidden py-2 px-4 sm:px-6 lg:px-12">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0 w-[42vw] xs:w-[38vw] sm:w-[220px] md:w-[240px] flex flex-col gap-2.5">
            <div className="aspect-square rounded-2xl bg-[#2B1B0C]/10 animate-pulse" />
            <div className="h-3 w-3/4 rounded-full bg-[#2B1B0C]/10 animate-pulse" />
            <div className="h-3 w-1/3 rounded-full bg-[#2B1B0C]/10 animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
