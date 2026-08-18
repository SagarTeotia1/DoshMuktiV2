export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="mb-8">
        <div className="w-24 h-2.5 rounded bg-[#DCC89E] mb-2" />
        <div className="w-40 h-7 rounded bg-[#DCC89E]" />
      </div>

      <div className="grid md:grid-cols-[1.5fr_1fr] gap-6 md:gap-8 items-start">
        <div className="flex flex-col gap-8">
          <div className="bg-brand-paper rounded-2xl p-5 sm:p-6">
            <div className="w-32 h-3 rounded bg-[#DCC89E] mb-4" />
            <div className="flex flex-col gap-3">
              <div className="h-11 rounded-xl bg-[#EBD8B4]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-11 rounded-xl bg-[#EBD8B4]" />
                <div className="h-11 rounded-xl bg-[#EBD8B4]" />
              </div>
            </div>
          </div>
          <div className="bg-brand-paper rounded-2xl p-5 sm:p-6">
            <div className="w-36 h-3 rounded bg-[#DCC89E] mb-4" />
            <div className="flex flex-col gap-3">
              <div className="h-11 rounded-xl bg-[#EBD8B4]" />
              <div className="h-11 rounded-xl bg-[#EBD8B4]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-11 rounded-xl bg-[#EBD8B4]" />
                <div className="h-11 rounded-xl bg-[#EBD8B4]" />
              </div>
              <div className="h-11 rounded-xl bg-[#EBD8B4]" />
            </div>
          </div>
        </div>

        <div className="bg-brand-paper rounded-2xl p-5 sm:p-6 h-fit flex flex-col gap-3">
          <div className="w-28 h-3 rounded bg-[#DCC89E] mb-1" />
          <div className="w-full h-3 rounded bg-[#EBD8B4]" />
          <div className="w-full h-3 rounded bg-[#EBD8B4]" />
          <div className="w-full h-3 rounded bg-[#EBD8B4]" />
          <div className="w-full h-5 rounded bg-[#DCC89E] mt-2" />
          <div className="w-full h-14 rounded-full bg-[#DCC89E] mt-2" />
        </div>
      </div>
    </div>
  );
}
