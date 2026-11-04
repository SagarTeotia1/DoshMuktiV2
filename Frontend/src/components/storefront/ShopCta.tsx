import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/** The "go shop" button: a soft bronze pill with an arrow that eases forward on hover. */
export function ShopCta({ onClick, className = '' }: { onClick?: () => void; className?: string }) {
  return (
    <Link
      href="/shop"
      onClick={onClick}
      className={`group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-[#B06A2E] to-[#8A4E1F] px-8 py-3.5 font-body text-sm font-bold tracking-wide text-[#FBF1DB] shadow-[0_8px_20px_-6px_rgba(138,78,31,0.55),inset_0_1px_0_rgba(255,255,255,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-6px_rgba(138,78,31,0.65),inset_0_1px_0_rgba(255,255,255,0.18)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A4E1F] ${className}`}
    >
      See Our Collection
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={2.25} />
    </Link>
  );
}
