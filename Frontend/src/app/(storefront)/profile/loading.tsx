export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="w-40 h-7 rounded bg-[#DCC89E] mb-1.5" />
      <div className="w-56 h-3 rounded bg-[#DCC89E] mb-8" />

      <div className="bg-white rounded-2xl p-5 sm:p-6 mb-6 flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="w-8 h-8 rounded-full bg-[#EBD8B4] flex-shrink-0" />
            <div className="flex flex-col gap-1.5">
              <div className="w-16 h-2 rounded bg-[#DCC89E]" />
              <div className="w-32 h-3 rounded bg-[#DCC89E]" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 h-11 rounded-lg bg-[#EBD8B4]" />
        <div className="flex-1 h-11 rounded-lg bg-[#EBD8B4]" />
      </div>
    </div>
  );
}
