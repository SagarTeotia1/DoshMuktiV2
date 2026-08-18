export default function Loading() {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 py-12 sm:py-20 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-[#EBD8B4]" />
        <div className="w-24 h-2.5 rounded bg-[#DCC89E]" />
      </div>
      <div className="w-56 h-7 rounded bg-[#DCC89E] mb-6" />

      <div className="flex flex-col gap-3">
        <div className="h-12 rounded-xl bg-[#EBD8B4]" />
        <div className="h-12 rounded-lg bg-[#DCC89E]" />
      </div>
    </div>
  );
}
