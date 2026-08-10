export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-6 sm:mb-8">
        <div className="w-10 h-2.5 rounded bg-[#EADFC8]" />
        <div className="w-10 h-2.5 rounded bg-[#EADFC8]" />
        <div className="w-24 h-2.5 rounded bg-[#EADFC8]" />
      </div>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
        {/* Gallery */}
        <div className="flex flex-col gap-6">
          <div className="aspect-square rounded-2xl bg-[#F6E4C2]" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="w-16 h-16 rounded-lg bg-[#F6E4C2]" />
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <div className="w-3/4 h-7 rounded bg-[#EADFC8] mb-3" />
          <div className="w-32 h-3 rounded bg-[#EADFC8] mb-4" />
          <div className="flex gap-1.5 mb-4">
            <div className="w-16 h-5 rounded-full bg-[#F6E4C2]" />
            <div className="w-16 h-5 rounded-full bg-[#F6E4C2]" />
          </div>
          <div className="w-40 h-9 rounded bg-[#EADFC8] mb-5" />
          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="h-12 rounded-lg bg-[#F6E4C2]" />
            <div className="h-12 rounded-lg bg-[#F6E4C2]" />
          </div>
          <div className="h-24 rounded-lg bg-[#F6E4C2] mb-6" />
          <div className="w-full h-14 rounded-full bg-[#EADFC8] mb-6" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-4 rounded bg-[#F6E4C2]" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
