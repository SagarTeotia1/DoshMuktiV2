export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="w-52 h-7 rounded bg-[#DCC89E] mb-1" />
      <div className="w-36 h-2.5 rounded bg-[#DCC89E] mb-6" />

      <div className="bg-white rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#EBD8B4] flex-shrink-0" />
              {i < 3 && <div className="h-0.5 flex-1 bg-[#EBD8B4]" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-[1.4fr_1fr] gap-6">
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-6 flex flex-col gap-3 h-40" />
          <div className="bg-white rounded-2xl p-6 h-28" />
        </div>
        <div className="bg-white rounded-2xl p-6 h-52" />
      </div>
    </div>
  );
}
