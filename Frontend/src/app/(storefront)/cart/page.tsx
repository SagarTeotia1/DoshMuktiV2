'use client';

import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { formatCurrency } from '@/lib/formatters';
import { SHIPPING_FEE, FREE_SHIPPING_ABOVE } from '@/lib/constants';

export default function CartPage() {
  const { cart, isLoading, updateQuantity, removeItem, isUpdating, isRemoving } = useCart();
  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const shippingFee = subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_ABOVE - subtotal);
  const total = subtotal + shippingFee;

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-[#8A7A63] font-body text-sm">Loading cart...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 sm:py-28 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full border border-[#2B1B0C] bg-white flex items-center justify-center mb-5">
          <ShoppingBag className="w-6 h-6 text-[#9C5A26]" />
        </div>
        <h1 className="font-heading text-2xl sm:text-3xl font-black uppercase tracking-tighter text-[#2B1B0C] mb-2">Your Cart is Empty</h1>
        <p className="font-body text-sm text-[#8A7A63] mb-7 max-w-xs">
          Nothing here yet. Explore products curated by intention and start your ritual.
        </p>
        <Link
          href="/shop"
          className="inline-block bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
          {items.reduce((n, i) => n + i.quantity, 0)} Items
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter uppercase text-[#2B1B0C]">Your Cart</h1>
      </div>

      {remainingForFreeShipping > 0 && (
        <div className="bg-[#F6E4C2] border border-[#2B1B0C]/20 rounded-2xl px-4 py-3 mb-6 font-body text-xs text-[#6B5539]">
          Add <span className="font-bold text-[#2B1B0C]">{formatCurrency(remainingForFreeShipping)}</span> more to unlock free shipping.
        </div>
      )}

      <div className="flex flex-col gap-3 mb-8">
        {items.map((item) => (
          <div key={item.variantId} className="flex items-center gap-3 sm:gap-4 bg-white border border-[#2B1B0C] rounded-2xl p-3 sm:p-4">
            <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#F6E4C2] border border-[#2B1B0C]/20 flex items-center justify-center">
              <span className="font-heading font-black text-lg text-[#9C5A26]">{item.productName.charAt(0)}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-xs sm:text-sm text-[#2B1B0C] truncate">{item.productName}</p>
              <p className="font-body text-[10px] sm:text-xs text-[#8A7A63]">{item.sku}</p>
              <p className="font-heading font-bold text-xs sm:text-sm text-[#2B1B0C] mt-1">{formatCurrency(item.price)}</p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                disabled={isUpdating}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#2B1B0C] flex items-center justify-center hover:bg-[#F6E4C2] disabled:opacity-50 transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-body text-sm w-5 text-center tabular-nums">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                disabled={isUpdating || item.quantity >= item.maxStock}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[#2B1B0C] flex items-center justify-center hover:bg-[#F6E4C2] disabled:opacity-50 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <button
              onClick={() => removeItem(item.variantId)}
              disabled={isRemoving}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#8A7A63] hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              aria-label="Remove item"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#2B1B0C] rounded-2xl p-5 sm:p-6 flex flex-col gap-2">
        <div className="flex justify-between font-body text-sm text-[#6B5539]">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between font-body text-sm text-[#6B5539]">
          <span>Shipping</span>
          <span>{shippingFee === 0 ? 'Free' : formatCurrency(shippingFee)}</span>
        </div>
        <div className="flex justify-between font-heading font-bold text-lg text-[#2B1B0C] pt-3 border-t border-[#2B1B0C]/10">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>

        <Link
          href="/checkout"
          className="mt-4 bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm text-center hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200"
        >
          Proceed to Checkout
        </Link>
        <Link
          href="/shop"
          className="text-center font-body text-xs font-bold uppercase tracking-widest text-[#8A7A63] hover:text-[#9C5A26] transition-colors mt-1 py-2"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
