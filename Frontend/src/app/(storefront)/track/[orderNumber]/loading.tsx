export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="w-52 h-7 rounded bg-[#DCC89E] mb-1" />
      <div className="w-36 h-2.5 rounded bg-[#DCC89E] mb-6" />

      <div className="bg-white rounded-2xl p-6 mb-6">
        <div className="w-28 h-6 rounded-full bg-[#EBD8B4] mb-3" />
        <div className="w-40 h-2.5 rounded bg-[#DCC89E]" />
      </div>

      <div className="bg-white rounded-2xl p-6 flex flex-col gap-3">
        <div className="w-20 h-4 rounded bg-[#DCC89E] mb-1" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex justify-between">
            <div className="w-40 h-3 rounded bg-[#EBD8B4]" />
            <div className="w-16 h-3 rounded bg-[#EBD8B4]" />
          </div>
        ))}
      </div>
    </div>
  );
}
