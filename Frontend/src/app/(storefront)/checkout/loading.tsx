export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-pulse">
      <div className="mb-8">
        <div className="w-24 h-2.5 rounded bg-[#EADFC8] mb-2" />
        <div className="w-40 h-7 rounded bg-[#EADFC8]" />
      </div>

      <div className="grid md:grid-cols-[1.5fr_1fr] gap-6 md:gap-8 items-start">
        <div className="flex flex-col gap-8">
          <div className="bg-brand-paper rounded-2xl p-5 sm:p-6">
            <div className="w-32 h-3 rounded bg-[#EADFC8] mb-4" />
            <div className="flex flex-col gap-3">
              <div className="h-11 rounded-xl bg-[#F6E4C2]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-11 rounded-xl bg-[#F6E4C2]" />
                <div className="h-11 rounded-xl bg-[#F6E4C2]" />
              </div>
            </div>
          </div>
          <div className="bg-brand-paper rounded-2xl p-5 sm:p-6">
            <div className="w-36 h-3 rounded bg-[#EADFC8] mb-4" />
            <div className="flex flex-col gap-3">
              <div className="h-11 rounded-xl bg-[#F6E4C2]" />
              <div className="h-11 rounded-xl bg-[#F6E4C2]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-11 rounded-xl bg-[#F6E4C2]" />
                <div className="h-11 rounded-xl bg-[#F6E4C2]" />
              </div>
              <div className="h-11 rounded-xl bg-[#F6E4C2]" />
            </div>
          </div>
        </div>

        <div className="bg-brand-paper rounded-2xl p-5 sm:p-6 h-fit flex flex-col gap-3">
          <div className="w-28 h-3 rounded bg-[#EADFC8] mb-1" />
          <div className="w-full h-3 rounded bg-[#F6E4C2]" />
          <div className="w-full h-3 rounded bg-[#F6E4C2]" />
          <div className="w-full h-3 rounded bg-[#F6E4C2]" />
          <div className="w-full h-5 rounded bg-[#EADFC8] mt-2" />
          <div className="w-full h-14 rounded-full bg-[#EADFC8] mt-2" />
        </div>
      </div>
    </div>
  );
}
