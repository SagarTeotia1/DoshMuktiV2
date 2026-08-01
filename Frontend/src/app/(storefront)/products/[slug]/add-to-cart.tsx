'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useCart } from '@/hooks/use-cart';
import { trackAddToCart } from '@/lib/firebase';
import type { Product } from '@/types/api.types';

export function AddToCart({ product }: { product: Product }) {
  const { addItem, isAdding } = useCart();
  const activeVariants = product.variants.filter((v) => v.isActive);
  const [variantId, setVariantId] = useState(activeVariants[0]?.id ?? '');
  const selected = activeVariants.find((v) => v.id === variantId);

  function handleAdd() {
    if (!selected) return;
    addItem({ variantId: selected.id, quantity: 1 });
    trackAddToCart({
      id: selected.id,
      name: product.name,
      price: selected.priceOverride ?? product.basePrice,
      quantity: 1,
    });
    toast.success('Added to cart');
  }

  if (activeVariants.length === 0) {
    return (
      <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#8A7A63] border border-[#2B1B0C]/20 rounded-full px-6 py-3">
        Currently Unavailable
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {activeVariants.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {activeVariants.map((v) => (
            <button
              key={v.id}
              onClick={() => setVariantId(v.id)}
              disabled={v.stockQuantity === 0}
              className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider font-body transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                variantId === v.id ? 'bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C]' : 'border-[#2B1B0C]/20 text-[#6B5539] hover:border-[#2B1B0C]'
              }`}
            >
              {Object.values(v.attributes).join(' / ') || v.sku}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={isAdding || !selected || selected.stockQuantity === 0}
        className="bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
      >
        {selected?.stockQuantity === 0 ? 'Sold Out' : isAdding ? 'Adding...' : 'Add to Cart'}
      </button>
    </div>
  );
}
