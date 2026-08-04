'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, ChevronDown } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types/api.types';

export function SidhiTabs({ product }: { product: Product }) {
  const { addItem, removeItem, cart, isAdding } = useCart();
  const serviceVariant = product.variants.find((v) => v.isActive && v.attributes.type === 'service');
  const hasSidhi = !!product.sidhiPrice && !!serviceVariant;
  const hasSelfGuide = !!product.selfEnergizeInstructions;
  const [selfOpen, setSelfOpen] = useState(false);

  if (!hasSidhi && !hasSelfGuide) return null;

  const inCart = !!serviceVariant && cart?.items.some((i) => i.variantId === serviceVariant.id);

  function toggleSidhi() {
    if (!serviceVariant) return;
    if (inCart) {
      removeItem(serviceVariant.id);
      toast.success('Sidhi service removed');
    } else {
      addItem({ variantId: serviceVariant.id, quantity: 1 });
      toast.success('Sidhi service added to cart');
    }
  }

  return (
    <div className="border-t border-[#2B1B0C]/10 pt-5 mb-6">
      {hasSidhi && (
        <label className="border border-[#2B1B0C] flex items-center gap-3 rounded-lg bg-[#F6E4C2]/40 px-4 py-3 shadow-neo-md cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!inCart}
            onChange={toggleSidhi}
            disabled={isAdding}
            className="w-4 h-4 accent-[#9C5A26] flex-shrink-0"
          />
          <span className="w-8 h-8 rounded-full bg-[#9C5A26]/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-[#9C5A26]" />
          </span>
          <span className="font-body text-xs sm:text-sm font-bold text-[#2B1B0C] flex-1">
            Get Siddh / Energized Product (Pran Pratishta)
          </span>
          <span className="font-heading font-black text-sm text-[#9C5A26] flex-shrink-0">
            +{formatCurrency(product.sidhiPrice!)}
          </span>
        </label>
      )}

      {hasSelfGuide && (
        <div className={hasSidhi ? 'mt-2' : ''}>
          <button
            type="button"
            onClick={() => setSelfOpen((v) => !v)}
            className="flex items-center gap-1.5 font-body text-xs font-bold text-[#6B5539] hover:text-[#9C5A26] transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${selfOpen ? 'rotate-180' : ''}`} />
            Prefer to energize it yourself?
          </button>
          {selfOpen && (
            <p className="font-body text-xs text-[#6B5539] leading-relaxed whitespace-pre-line mt-2 pl-5 border-l-2 border-[#9C5A26]/30">
              {product.selfEnergizeInstructions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
