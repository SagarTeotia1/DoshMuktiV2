export default function Loading() {
  return (
    <div className="animate-pulse">
      <section className="bg-[#2B1B0C] py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center flex flex-col items-center gap-3">
          <div className="w-20 h-2.5 rounded bg-[#4A3620]" />
          <div className="w-72 h-8 rounded bg-[#4A3620]" />
          <div className="w-full max-w-xl h-3 rounded bg-[#4A3620]" />
          <div className="w-3/4 max-w-xl h-3 rounded bg-[#4A3620]" />
        </div>
      </section>

      <section className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="w-52 h-6 rounded bg-[#EADFC8] mx-auto mb-10 sm:mb-14" />
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-4 rounded-xl bg-white p-5 sm:p-6">
                <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#F6E4C2]" />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="w-1/2 h-3 rounded bg-[#EADFC8]" />
                  <div className="w-full h-2.5 rounded bg-[#EADFC8]" />
                  <div className="w-3/4 h-2.5 rounded bg-[#EADFC8]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
