export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="w-40 h-7 rounded bg-[#DCC89E] mb-1.5" />
      <div className="w-56 h-3 rounded bg-[#DCC89E] mb-8" />

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="w-24 h-3 rounded bg-[#DCC89E]" />
              <div className="w-20 h-5 rounded-full bg-[#EBD8B4]" />
            </div>
            <div className="w-48 h-2.5 rounded bg-[#DCC89E] mb-2" />
            <div className="w-20 h-4 rounded bg-[#DCC89E]" />
          </div>
        ))}
      </div>
    </div>
  );
}
