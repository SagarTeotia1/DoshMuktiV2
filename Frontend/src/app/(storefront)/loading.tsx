export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Category strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-4 flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#EBD8B4]" />
            <div className="w-12 h-2.5 rounded bg-[#DCC89E]" />
          </div>
        ))}
      </div>

      {/* Hero carousel */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="w-full aspect-[16/7] rounded-2xl bg-[#EBD8B4]" />
      </div>

      {/* Purpose grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 grid grid-cols-3 sm:grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-[#EBD8B4]" />
        ))}
      </div>

      {/* Product rail */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6">
        <div className="w-40 h-5 rounded bg-[#DCC89E] mb-4 mx-auto" />
        <div className="flex gap-3 sm:gap-4 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex-shrink-0 w-40 sm:w-48">
              <div className="aspect-[4/5] rounded-xl bg-[#EBD8B4]" />
              <div className="w-3/4 h-3 rounded bg-[#DCC89E] mt-2.5" />
              <div className="w-1/2 h-3.5 rounded bg-[#DCC89E] mt-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
