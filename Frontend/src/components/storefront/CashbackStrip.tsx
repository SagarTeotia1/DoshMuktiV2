import { Wallet } from 'lucide-react';

export function CashbackStrip() {
  return (
    <div className="relative overflow-hidden bg-[#9C5A26] py-1.5 sm:py-2">
      <div
        className="animate-shimmer-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3"
        style={{ background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.16) 50%, transparent 80%)' }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-center gap-2">
        <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FBF1DF] flex-shrink-0 animate-pulse" strokeWidth={2} />
        <p className="font-body text-[11px] sm:text-xs font-bold uppercase tracking-wide text-[#FBF1DF] text-center">
          100% Cashback in Wallet on Your First Order
        </p>
      </div>
    </div>
  );
}
