'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useOrderNow } from './use-order-now';

// Deliberately not the neo-brutalist hard-shadow buttons the rest of the storefront
// uses — soft pill shapes and generous spacing, so this page reads as its own
// campaign moment rather than another catalog product page.
export function BuyNowButton({
  variantId,
  productName,
  price,
  maxQty,
  tone = 'light',
}: {
  variantId: string;
  productName: string;
  price: number;
  maxQty: number;
  tone?: 'light' | 'dark';
}) {
  const [quantity, setQuantity] = useState(1);
  const { orderNow, isOrdering } = useOrderNow(variantId, productName, price);

  const stepperShell = tone === 'dark' ? 'bg-white/10 text-[#E6D3AE]' : 'bg-white text-[#2B1B0C] shadow-sm';
  const stepperBtn = tone === 'dark' ? 'hover:bg-white/10' : 'hover:bg-[#F6E4C2]';
  const cta =
    tone === 'dark'
      ? 'bg-[#E6D3AE] text-[#2B1B0C] hover:bg-white'
      : 'bg-[#2B1B0C] text-[#E6D3AE] hover:bg-[#9C5A26] hover:text-[#2B1B0C]';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-between rounded-full px-1.5 py-1.5 ${stepperShell}`}>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className={`w-9 h-9 flex items-center justify-center rounded-full disabled:opacity-30 transition-colors ${stepperBtn}`}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="font-heading font-black text-base w-8 text-center tabular-nums">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={quantity >= maxQty}
            aria-label="Increase quantity"
            className={`w-9 h-9 flex items-center justify-center rounded-full disabled:opacity-30 transition-colors ${stepperBtn}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => orderNow(quantity)}
          disabled={isOrdering}
          className={`rounded-full px-8 py-3.5 font-body font-bold text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${cta}`}
        >
          {isOrdering ? 'Placing Order…' : `Buy Now — ${formatCurrency(price * quantity)}`}
        </button>
      </div>
      <p className={`text-center text-[11px] font-body ${tone === 'dark' ? 'text-[#E6D3AE]/60' : 'text-[#8A7A63]'}`}>
        Secure checkout · Pay via UPI, Cards or EMI
      </p>
    </div>
  );
}
