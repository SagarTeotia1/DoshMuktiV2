import { RETURN_ELIGIBLE_ABOVE } from '@/lib/constants';

const ITEMS = [
  'Free Shipping Above ₹399',
  'Authentic & Energized Products',
  `7-Day Easy Returns on Orders Above ₹${RETURN_ELIGIBLE_ABOVE}`,
  'Pay via UPI · Cards · EMI',
  'Pan-India Delivery',
  'Handpicked with Intention',
];

export function AnnouncementBar() {
  const repeated = [...ITEMS, ...ITEMS];

  return (
    <div className="bg-[#2B1B0C] text-[#E6D3AE] py-1.5 sm:py-2 overflow-hidden">
      <div className="flex animate-marquee whitespace-nowrap">
        {repeated.map((item, i) => (
          <span key={i} className="flex items-center">
            <span className="mx-6 sm:mx-8 text-[9px] sm:text-xs font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] font-body">
              {item}
            </span>
            <span className="text-[#9C5A26] text-[10px]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
