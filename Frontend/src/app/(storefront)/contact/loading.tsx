export default function Loading() {
  return (
    <div className="animate-pulse">
      <section className="bg-[#2B1B0C] py-14 sm:py-20">
        <div className="max-w-2xl mx-auto px-6 text-center flex flex-col items-center gap-3">
          <div className="w-24 h-2.5 rounded bg-[#4A3620]" />
          <div className="w-64 h-8 rounded bg-[#4A3620]" />
          <div className="w-full max-w-md h-3 rounded bg-[#4A3620]" />
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-12 sm:mb-16">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl bg-white p-5 sm:p-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#EBD8B4]" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="w-1/3 h-3 rounded bg-[#DCC89E]" />
                  <div className="w-2/3 h-2.5 rounded bg-[#DCC89E]" />
                </div>
              </div>
            ))}
          </div>
          <div className="w-64 h-3 rounded bg-[#DCC89E] mx-auto" />
        </div>
      </section>
    </div>
  );
}
