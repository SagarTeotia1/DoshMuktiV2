import { Gem, Truck, ShieldCheck, RotateCcw } from 'lucide-react';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';
import { BlobMotif } from '@/components/motion/BlobMotif';

const ITEMS = [
  { icon: Gem, label: 'Authentic & Energized', sub: 'Sourced directly from verified artisans' },
  { icon: Truck, label: 'Free Shipping ₹999+', sub: 'Pan-India delivery via Delhivery' },
  { icon: ShieldCheck, label: 'Secure Payments', sub: 'Powered by Razorpay' },
  { icon: RotateCcw, label: '7-Day Returns', sub: 'Hassle-free, no questions asked' },
];

export function TrustBar() {
  return (
    <section className="relative overflow-hidden bg-[#FFFDF8] border-y-2 border-[#2B1B0C] py-6 sm:py-8">
      <BlobMotif
        variant="b"
        className="pointer-events-none absolute -bottom-28 -left-24 w-72 h-72 text-[#9C5A26]/[0.07] -rotate-12"
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <StaggerGroup className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <StaggerItem key={item.label} className="group flex flex-col items-center text-center gap-3">
                <div className="brutal-border flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-white flex items-center justify-center transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 shadow-[3px_3px_0_0_#2B1B0C] group-hover:shadow-[5px_5px_0_0_#2B1B0C]">
                  <Icon className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-[#9C5A26]" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-heading font-bold text-[11px] sm:text-xs uppercase tracking-wide text-[#2B1B0C] leading-tight mb-1">
                    {item.label}
                  </p>
                  <p className="font-body text-[10px] sm:text-[11px] text-[#8A7A63] leading-snug">{item.sub}</p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}
