'use client';

import { Sparkles, X } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface Props {
  savings: number;
  onlineTotal: number;
  codTotal: number;
  onPayOnline: () => void;
  onContinueCod: () => void;
  onClose: () => void;
}

// Shown once when a customer presses continue on Cash on Delivery: nudges them to pay
// online (UPI/cards) to skip the COD charge, but never blocks — "Continue with COD" proceeds.
export function CodWarningModal({ savings, onlineTotal, codTotal, onPayOnline, onContinueCod, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Pay online and save"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-[#FFFDF8] border border-[#2B1B0C] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-[#8A7A63] hover:text-[#2B1B0C]"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 text-[#9C5A26]">
          <Sparkles className="w-5 h-5" />
          <p className="font-heading font-extrabold text-base text-[#2B1B0C]">
            Pay online &amp; save {formatCurrency(savings)}
          </p>
        </div>
        <p className="mt-2 font-body text-sm text-[#6B5539] leading-relaxed">
          Cash on Delivery adds a COD charge. Pay just{' '}
          <span className="font-bold text-[#2B1B0C]">{formatCurrency(onlineTotal)}</span> now by UPI, card or
          netbanking and keep your {formatCurrency(savings)}.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onPayOnline}
            className="rounded-full bg-[#2B1B0C] px-6 py-2.5 font-body text-sm font-bold uppercase tracking-wider text-white hover:bg-[#9C5A26] transition-colors"
          >
            <span className="block">Pay {formatCurrency(onlineTotal)} online</span>
            <span className="block text-[11px] font-semibold normal-case tracking-normal text-[#E6D3AE]">
              Save {formatCurrency(savings)}
            </span>
          </button>
          <button
            type="button"
            onClick={onContinueCod}
            className="rounded-full border border-[#2B1B0C]/30 px-6 py-2.5 font-body text-xs font-bold uppercase tracking-wider text-[#6B5539] hover:border-[#2B1B0C] transition-colors"
          >
            <span className="block">Continue with COD</span>
            <span className="block text-[11px] font-semibold normal-case tracking-normal text-[#1E7B4A]">
              {formatCurrency(codTotal)} · Save {formatCurrency(savings)} on prepaid
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
