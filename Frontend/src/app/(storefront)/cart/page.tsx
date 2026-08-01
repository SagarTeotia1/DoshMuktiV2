'use client';

import Link from 'next/link';
import { useCart } from '@/hooks/use-cart';
import { formatCurrency } from '@/lib/formatters';
import { SHIPPING_FEE, FREE_SHIPPING_ABOVE } from '@/lib/constants';

export default function CartPage() {
  const { cart, isLoading, updateQuantity, removeItem, isUpdating, isRemoving } = useCart();
  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const shippingFee = subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingFee;

  if (isLoading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-[#8A7A63] font-body text-sm">Loading cart...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="font-heading text-2xl font-black uppercase tracking-tighter text-[#2B1B0C] mb-3">Your Cart is Empty</h1>
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
      <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter uppercase text-[#2B1B0C] mb-8">Your Cart</h1>

      <div className="flex flex-col gap-4 mb-8">
        {items.map((item) => (
          <div key={item.variantId} className="flex items-center gap-4 bg-white border border-[#2B1B0C] rounded-2xl p-4">
            <div className="flex-1">
              <p className="font-heading font-bold text-sm text-[#2B1B0C]">{item.productName}</p>
              <p className="font-body text-xs text-[#8A7A63]">{item.sku}</p>
              <p className="font-heading font-bold text-sm text-[#2B1B0C] mt-1">{formatCurrency(item.price)}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                disabled={isUpdating}
                className="w-8 h-8 rounded-full border border-[#2B1B0C] flex items-center justify-center hover:bg-[#F6E4C2] disabled:opacity-50"
              >
                −
              </button>
              <span className="font-body text-sm w-6 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                disabled={isUpdating || item.quantity >= item.maxStock}
                className="w-8 h-8 rounded-full border border-[#2B1B0C] flex items-center justify-center hover:bg-[#F6E4C2] disabled:opacity-50"
              >
                +
              </button>
            </div>

            <button
              onClick={() => removeItem(item.variantId)}
              disabled={isRemoving}
              className="font-body text-xs font-bold uppercase tracking-wider text-[#8A7A63] hover:text-[#9C5A26] transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#2B1B0C] rounded-2xl p-6 flex flex-col gap-2">
        <div className="flex justify-between font-body text-sm text-[#6B5539]">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between font-body text-sm text-[#6B5539]">
          <span>Shipping</span>
          <span>{shippingFee === 0 ? 'Free' : formatCurrency(shippingFee)}</span>
        </div>
        <div className="flex justify-between font-heading font-bold text-lg text-[#2B1B0C] pt-2 border-t border-[#2B1B0C]/10">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>

        <Link
          href="/checkout"
          className="mt-4 bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm text-center hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
