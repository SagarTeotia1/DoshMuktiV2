import { Gem, Truck, ShieldCheck, RotateCcw } from 'lucide-react';

const ITEMS = [
  { icon: Gem, label: 'Authentic & Energized', sub: 'Sourced directly from verified artisans' },
  { icon: Truck, label: 'Free Shipping ₹999+', sub: 'Pan-India delivery via Delhivery' },
  { icon: ShieldCheck, label: 'Secure Payments', sub: 'Powered by Razorpay' },
  { icon: RotateCcw, label: '7-Day Returns', sub: 'Hassle-free, no questions asked' },
];

export function TrustBar() {
  return (
    <section className="bg-[#F6E4C2] border-y border-[#2B1B0C] relative">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#9C5A26] to-transparent opacity-60" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className={`flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-4 py-6 sm:py-7 px-3 sm:px-5 md:px-6 text-center sm:text-left ${
                  idx < ITEMS.length - 1 ? 'border-r border-[#2B1B0C]/15' : ''
                } ${idx === 2 ? 'border-r-0 md:border-r border-[#2B1B0C]/15' : ''}`}
              >
                <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-[#2B1B0C] flex items-center justify-center bg-white transition-colors duration-200">
                  <Icon className="w-4 h-4 text-[#9C5A26]" />
                </div>
                <div>
                  <p className="font-heading font-bold text-[11px] sm:text-xs uppercase tracking-wide text-[#2B1B0C] leading-tight mb-0.5">
                    {item.label}
                  </p>
                  <p className="font-body text-[10px] sm:text-[11px] text-[#8A7A63] leading-snug">{item.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
