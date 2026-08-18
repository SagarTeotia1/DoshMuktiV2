export default function Loading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center animate-pulse">
      <div className="w-16 h-16 rounded-full bg-[#EBD8B4] mx-auto mb-6" />
      <div className="w-64 h-7 rounded bg-[#DCC89E] mx-auto mb-3" />
      <div className="w-40 h-3 rounded bg-[#DCC89E] mx-auto mb-1" />
      <div className="w-72 h-3 rounded bg-[#DCC89E] mx-auto mb-8" />

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <div className="w-40 h-14 rounded-full bg-[#EBD8B4]" />
        <div className="w-40 h-14 rounded-full bg-[#EBD8B4]" />
      </div>
    </div>
  );
}
