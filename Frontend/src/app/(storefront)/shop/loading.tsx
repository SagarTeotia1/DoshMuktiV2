export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8 flex flex-col lg:flex-row gap-6 lg:gap-10 animate-pulse">
      {/* Desktop filters sidebar */}
      <div className="hidden lg:block lg:w-56 flex-shrink-0">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i}>
              <div className="w-24 h-3 rounded bg-[#DCC89E] mb-3" />
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }, (_, j) => (
                  <div key={j} className="w-full h-3 rounded bg-[#EBD8B4]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <div className="w-28 h-4 rounded bg-[#DCC89E]" />
          <div className="w-32 h-8 rounded-full bg-[#EBD8B4]" />
        </div>

        {/* Product grid — mirrors ProductCard: aspect-[4/5] image + two text lines */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="rounded-2xl bg-[#FCEFE0] pt-3 pl-3 pr-4 pb-4 sm:pt-4 sm:pl-4 sm:pr-5 sm:pb-5">
              <div className="aspect-[4/5] rounded-xl bg-[#EBD8B4]" />
              <div className="pt-2.5 sm:pt-3 flex flex-col gap-1.5">
                <div className="w-full h-3 rounded bg-[#DCC89E]" />
                <div className="w-2/3 h-3 rounded bg-[#DCC89E]" />
                <div className="w-1/3 h-4 rounded bg-[#DCC89E] mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
