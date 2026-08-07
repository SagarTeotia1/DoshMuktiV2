'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { trackAddToCart } from '@/lib/firebase';
import type { Product } from '@/types/api.types';

export function AddToCart({ product }: { product: Product }) {
  const router = useRouter();
  const { addItem, isAdding } = useCart();
  const { addItemAsync: buyNowAddItemAsync, clearCart: buyNowClearCart } = useCart('buyNow');
  const activeVariants = product.variants.filter((v) => v.isActive && v.attributes.type !== 'service');
  const [variantId, setVariantId] = useState(activeVariants[0]?.id ?? '');
  const selected = activeVariants.find((v) => v.id === variantId);
  const [quantity, setQuantity] = useState(1);
  const [isOrdering, setIsOrdering] = useState(false);
  const maxQty = Math.min(selected?.stockQuantity ?? 1, 99);

  function changeVariant(id: string) {
    setVariantId(id);
    setQuantity(1);
  }

  function track() {
    if (!selected) return;
    trackAddToCart({
      id: selected.id,
      name: product.name,
      price: selected.priceOverride ?? product.basePrice,
      quantity,
    });
  }

  function handleAdd() {
    if (!selected) return;
    addItem({ variantId: selected.id, quantity });
    track();
    toast.success('Added to cart');
  }

  async function handleOrderNow() {
    if (!selected) return;
    setIsOrdering(true);
    try {
      // Buy Now uses an isolated pseudo-cart, never the real one — clear any
      // leftover item from a previous abandoned attempt, then add just this one.
      await buyNowClearCart();
      await buyNowAddItemAsync({ variantId: selected.id, quantity });
      track();
      router.push('/checkout?mode=buyNow');
    } catch {
      toast.error('Could not start checkout — try again');
      setIsOrdering(false);
    }
  }

  if (activeVariants.length === 0) {
    return (
      <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#8A7A63] border border-[#2B1B0C]/20 rounded-lg px-6 py-3">
        Currently Unavailable
      </span>
    );
  }

  const soldOut = selected?.stockQuantity === 0;

  return (
    <div className="flex flex-col gap-4">
      {activeVariants.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {activeVariants.map((v) => (
            <button
              key={v.id}
              onClick={() => changeVariant(v.id)}
              disabled={v.stockQuantity === 0}
              className={`px-4 py-2 rounded-lg border text-xs font-bold uppercase tracking-wider font-body transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                variantId === v.id ? 'bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C]' : 'border-[#2B1B0C]/20 text-[#6B5539] hover:border-[#2B1B0C]'
              }`}
            >
              {Object.values(v.attributes).join(' / ') || v.sku}
            </button>
          ))}
        </div>
      )}

      {/* Quantity + secondary "add to cart" — small, quiet, not competing with the primary CTA */}
      <div className="flex items-center gap-3">
        <div className="border border-[#2B1B0C] flex items-center justify-between rounded-lg px-2 py-1.5 shadow-neo-md flex-shrink-0">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label="Decrease quantity"
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#2B1B0C] hover:bg-[#F6E4C2] disabled:opacity-30 transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="font-heading font-bold text-sm text-[#2B1B0C] tabular-nums w-6 text-center">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={quantity >= maxQty}
            aria-label="Increase quantity"
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#2B1B0C] hover:bg-[#F6E4C2] disabled:opacity-30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={handleAdd}
          disabled={isAdding || !selected || soldOut}
          aria-label="Add to cart"
          className="flex-1 flex items-center justify-center gap-1.5 border border-[#2B1B0C]/25 text-[#6B5539] rounded-lg py-2.5 font-body font-semibold text-xs uppercase tracking-wider hover:border-[#2B1B0C] hover:text-[#2B1B0C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          {isAdding ? 'Adding...' : 'Add to Cart'}
        </button>
      </div>

      {/* Primary CTA — the one decisive action on this page */}
      <button
        onClick={handleOrderNow}
        disabled={isOrdering || !selected || soldOut}
        className="border border-[#2B1B0C] bg-[#B23A2E] text-white rounded-lg px-8 py-4 font-body font-bold uppercase tracking-widest text-base hover:bg-[#2B1B0C] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full shadow-neo-gold-md active:scale-[0.98]"
      >
        {soldOut ? 'Sold Out' : isOrdering ? 'Placing Order...' : 'Order Now'}
      </button>
    </div>
  );
}
