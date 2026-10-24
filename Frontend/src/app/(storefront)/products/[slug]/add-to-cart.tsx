'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Minus, Plus, ShoppingBag, Truck } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useActiveCartScope } from '@/hooks/use-active-cart-scope';
import { useAuth } from '@/providers/auth-provider';
import { useShippingEstimate } from '@/hooks/use-shipping-estimate';
import { trackAddToCart } from '@/lib/analytics';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types/api.types';

export function AddToCart({ product }: { product: Product }) {
  const router = useRouter();
  const { addItemAsync, isAdding } = useCart(useActiveCartScope());
  const { addItemAsync: buyNowAddItemAsync } = useCart('buyNow');
  const { loading: authLoading } = useAuth();
  const activeVariants = product.variants.filter((v) => v.isActive && v.attributes.type !== 'service');
  const [variantId, setVariantId] = useState(activeVariants[0]?.id ?? '');
  const selected = activeVariants.find((v) => v.id === variantId);
  const [quantity, setQuantity] = useState(1);
  const [isOrdering, setIsOrdering] = useState(false);
  const maxQty = Math.min(selected?.stockQuantity ?? 1, 99);
  const unitPrice = selected?.priceOverride ?? product.basePrice;
  const ctaRef = useRef<HTMLButtonElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  const mrp = product.compareAtPrice && product.compareAtPrice > unitPrice ? product.compareAtPrice : null;
  const discountPct = mrp ? Math.round(((mrp - unitPrice) / mrp) * 100) : null;
  const thumb = product.images[0]?.thumb;
  const shipping = useShippingEstimate(unitPrice * quantity, (selected?.weight ?? 500) * quantity);

  // Sticky buy bar: shown once the main "Order Now" button leaves the viewport (scrolled past
  // on desktop, still below the fold on phones), hidden again when it comes back into view.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setShowSticky(!entries[0]?.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Lets other fixed widgets (chat launcher) lift clear of the bar.
  useEffect(() => {
    document.body.classList.toggle('has-buybar', showSticky);
    return () => document.body.classList.remove('has-buybar');
  }, [showSticky]);

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

  async function handleAdd() {
    if (!selected) return;
    try {
      await addItemAsync({ variantId: selected.id, quantity });
      track();
      toast.success('Added to cart');
    } catch {
      toast.error('Could not add to cart — try again');
    }
  }

  async function handleOrderNow() {
    if (!selected) return;
    if (authLoading) return;
    setIsOrdering(true);
    try {
      // Buy Now uses an isolated pseudo-cart, never the real one — but it accumulates
      // across repeat "Order Now" clicks rather than wiping on each one, so a customer
      // who reaches checkout, goes back for one more item, and hits "Order Now" again
      // doesn't lose what they already had queued up. It's still cleared server-side
      // once an order from it actually completes (see checkout/controller.ts) and
      // naturally expires via the cart's TTL otherwise, so nothing lingers forever.
      // No separate auth check/redirect here — /checkout itself handles phone+OTP
      // login inline now (next to the order summary), so an unauthenticated
      // customer just lands there and logs in without ever leaving the page.
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

      {/* Estimated shipping — origin-to-origin (real destination pincode isn't known until
          checkout), same math the cart preview uses. Struck-through once the free-shipping
          threshold is met, so the customer sees what they're saving, not just "Free". */}
      {shipping.data && (
        shipping.data.fee > 0 ? (
          <p className="flex items-center gap-1.5 font-body text-xs text-[#6B5539]">
            <Truck className="w-4 h-4 text-[#9C5A26]" />
            Shipping: <span className="font-semibold text-[#2B1B0C]">{formatCurrency(shipping.data.fee)}</span> (estimated)
          </p>
        ) : (
          <p className="inline-flex items-center gap-2 self-start rounded-lg border border-brand-success/30 bg-brand-success/10 px-3 py-1.5 font-body text-xs text-[#2B1B0C]">
            <Truck className="w-4 h-4 text-brand-success" />
            {shipping.data.originalFee > 0 && (
              <span className="line-through text-[#8A7A63]">{formatCurrency(shipping.data.originalFee)}</span>
            )}
            <span className="font-extrabold uppercase tracking-wide text-brand-success">Free Delivery</span>
          </p>
        )
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
        ref={ctaRef}
        onClick={handleOrderNow}
        disabled={isOrdering || !selected || soldOut}
        className="border border-[#2B1B0C] bg-[#B23A2E] text-white rounded-lg px-8 py-4 font-body font-bold uppercase tracking-widest text-base hover:bg-[#2B1B0C] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed w-full shadow-neo-gold-md active:scale-[0.98]"
      >
        {soldOut ? 'Sold Out' : isOrdering ? 'Placing Order...' : 'Order Now'}
      </button>

      {/* Sticky buy bar — full-width on phones, floating card (bottom-right) on laptops */}
      <div
        inert={!showSticky}
        className={`fixed z-50 inset-x-2 bottom-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[400px] bg-[#FFFDF8] border border-[#9C5A26] rounded-2xl shadow-[0_-6px_18px_rgba(107,61,25,0.18)] lg:shadow-neo-gold-md overflow-hidden mb-[env(safe-area-inset-bottom)] transition-all duration-300 ${
          showSticky ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <p className="bg-gradient-to-r from-[#6B3D19] via-[#9C5A26] to-[#C9863F] text-[#FFFDF8] text-center text-xs font-bold font-body tracking-wide py-1.5 px-3">
          ✓ 100% Authentic &amp; Verified Products
        </p>
        <div className="flex items-center gap-3 p-3">
          {thumb && (
            <Image src={thumb} alt="" width={64} height={64} className="hidden lg:block w-16 h-16 rounded-lg object-cover border border-[#2B1B0C]/15 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5 mb-2">
              <span className="font-heading font-extrabold text-lg text-[#2B1B0C] leading-none">{formatCurrency(unitPrice * quantity)}</span>
              {mrp && <span className="font-body text-xs text-[#8A7A63] line-through">{formatCurrency(mrp * quantity)}</span>}
              {discountPct && (
                <span className="font-body text-xs font-bold text-brand-success">{discountPct}% OFF</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleAdd}
                disabled={isAdding || !selected || soldOut}
                className="flex items-center justify-center gap-1.5 border border-[#2B1B0C] bg-white text-[#2B1B0C] rounded-lg py-2.5 font-body font-bold text-xs uppercase tracking-wider hover:bg-[#F6E4C2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {isAdding ? 'Adding...' : 'Add to Cart'}
              </button>
              <button
                onClick={handleOrderNow}
                disabled={isOrdering || !selected || soldOut}
                className="border border-[#2B1B0C] bg-[#B23A2E] text-white rounded-lg py-2.5 font-body font-bold text-xs uppercase tracking-wider hover:bg-[#2B1B0C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {soldOut ? 'Sold Out' : isOrdering ? 'Placing...' : 'Buy Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
