export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="mb-8">
        <div className="w-16 h-2.5 rounded bg-[#EADFC8] mb-2" />
        <div className="w-40 h-7 rounded bg-[#EADFC8]" />
      </div>

      <div className="flex flex-col gap-3 mb-8">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 sm:gap-4 bg-[#FCEFE0] rounded-2xl p-3 sm:p-4">
            <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#F6E4C2]" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="w-2/3 h-3 rounded bg-[#EADFC8]" />
              <div className="w-1/3 h-2.5 rounded bg-[#EADFC8]" />
              <div className="w-1/4 h-3 rounded bg-[#EADFC8]" />
            </div>
            <div className="w-20 h-8 rounded-full bg-[#F6E4C2] flex-shrink-0" />
          </div>
        ))}
      </div>

      <div className="bg-brand-paper rounded-2xl p-5 sm:p-6 flex flex-col gap-3">
        <div className="w-full h-3 rounded bg-[#F6E4C2]" />
        <div className="w-full h-3 rounded bg-[#F6E4C2]" />
        <div className="w-full h-5 rounded bg-[#EADFC8] mt-2" />
        <div className="w-full h-14 rounded-full bg-[#EADFC8] mt-3" />
      </div>
    </div>
  );
}
