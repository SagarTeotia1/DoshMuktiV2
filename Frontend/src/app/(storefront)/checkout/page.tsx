'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCart } from '@/hooks/use-cart';
import { usePincodeCheck } from '@/hooks/use-pincode-check';
import { useRazorpay } from '@/hooks/use-razorpay';
import { api, ApiError } from '@/lib/api-client';
import { getSessionId } from '@/lib/session';
import { formatCurrency } from '@/lib/formatters';
import { SHIPPING_FEE, FREE_SHIPPING_ABOVE } from '@/lib/constants';
import { trackBeginCheckout, trackPurchase } from '@/lib/firebase';
import type { CheckoutInput, CheckoutResponse } from '@/types/api.types';
import type { RazorpayResponse } from '@/hooks/use-razorpay';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart } = useCart();
  const { openCheckout, loading: rzpLoading } = useRazorpay();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
  });

  const { isChecking, isServiceable } = usePincodeCheck(form.pincode);

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const shippingFee = subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingFee;

  useEffect(() => {
    if (items.length > 0) trackBeginCheckout(total, items.length);
  }, [items.length, total]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return toast.error('Your cart is empty');
    if (isServiceable === false) return toast.error('Sorry, we do not deliver to this pincode yet');

    setSubmitting(true);
    try {
      const input: CheckoutInput = {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        shippingAddress: {
          line1: form.line1,
          line2: form.line2 || undefined,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
        },
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      };

      const result = await api.post<CheckoutResponse>('/api/checkout', input, { 'x-session-id': getSessionId() });

      await openCheckout({
        amount: result.amount,
        currency: result.currency,
        name: 'Doshhmukti',
        order_id: result.rzpOrderId,
        prefill: { name: form.customerName, email: form.customerEmail, contact: form.customerPhone },
        theme: { color: '#9C5A26' },
        handler: (response: RazorpayResponse) => {
          trackPurchase({ orderNumber: result.orderNumber, total, itemCount: items.length });
          router.push(
            `/checkout/success?orderNumber=${result.orderNumber}&paymentId=${response.razorpay_payment_id}`
          );
        },
        modal: { ondismiss: () => setSubmitting(false) },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.body.error);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tighter uppercase text-[#2B1B0C] mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-[1.5fr_1fr] gap-8">
        <div className="flex flex-col gap-4">
          <input
            required
            placeholder="Full Name"
            value={form.customerName}
            onChange={(e) => update('customerName', e.target.value)}
            className="bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body"
          />
          <input
            required
            type="tel"
            placeholder="Mobile Number"
            value={form.customerPhone}
            onChange={(e) => update('customerPhone', e.target.value)}
            className="bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={form.customerEmail}
            onChange={(e) => update('customerEmail', e.target.value)}
            className="bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body"
          />
          <input
            required
            placeholder="Address Line 1"
            value={form.line1}
            onChange={(e) => update('line1', e.target.value)}
            className="bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body"
          />
          <input
            placeholder="Address Line 2 (optional)"
            value={form.line2}
            onChange={(e) => update('line2', e.target.value)}
            className="bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body"
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              required
              placeholder="City"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              className="bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body"
            />
            <input
              required
              placeholder="State"
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
              className="bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body"
            />
          </div>
          <div>
            <input
              required
              placeholder="Pincode"
              value={form.pincode}
              onChange={(e) => update('pincode', e.target.value)}
              className="bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body w-full"
            />
            {isChecking && <p className="text-xs text-[#8A7A63] mt-1 font-body">Checking serviceability...</p>}
            {isServiceable === false && <p className="text-xs text-red-600 mt-1 font-body">Not serviceable at this pincode</p>}
            {isServiceable === true && <p className="text-xs text-green-700 mt-1 font-body">✓ Deliverable</p>}
          </div>
        </div>

        <div className="bg-white border border-[#2B1B0C] rounded-2xl p-6 h-fit flex flex-col gap-2">
          <h2 className="font-heading font-bold text-lg text-[#2B1B0C] mb-2">Order Summary</h2>
          {items.map((item) => (
            <div key={item.variantId} className="flex justify-between font-body text-xs text-[#6B5539]">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <span>{formatCurrency(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between font-body text-sm text-[#6B5539] pt-2 border-t border-[#2B1B0C]/10">
            <span>Shipping</span>
            <span>{shippingFee === 0 ? 'Free' : formatCurrency(shippingFee)}</span>
          </div>
          <div className="flex justify-between font-heading font-bold text-lg text-[#2B1B0C] pt-2 border-t border-[#2B1B0C]/10">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>

          <button
            type="submit"
            disabled={submitting || rzpLoading || items.length === 0}
            className="mt-4 bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Processing...' : 'Pay Now'}
          </button>
        </div>
      </form>
    </div>
  );
}
