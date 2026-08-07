'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, Wallet } from 'lucide-react';
import { useCart, type CartScope } from '@/hooks/use-cart';
import { usePincodeCheck } from '@/hooks/use-pincode-check';
import { useWalletBalance } from '@/hooks/use-wallet-balance';
import { useRazorpay } from '@/hooks/use-razorpay';
import { useAuth } from '@/hooks/use-auth';
import { api, ApiError } from '@/lib/api-client';
import { getSessionId, getBuyNowSessionId } from '@/lib/session';
import { getToken } from '@/lib/auth';
import { formatCurrency } from '@/lib/formatters';
import { SHIPPING_FEE, FREE_SHIPPING_ABOVE } from '@/lib/constants';
import { trackBeginCheckout, trackPurchase } from '@/lib/firebase';
import type { CheckoutInput, CheckoutResponse, CouponPreviewResponse } from '@/types/api.types';
import type { RazorpayResponse } from '@/hooks/use-razorpay';

const inputClass =
  'bg-[#FBF1DF] border border-[#2B1B0C]/25 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:border-[#9C5A26] focus:outline-none font-body placeholder:text-[#8A7A63] transition-colors';

const COUPON_ERROR_CODES = new Set([
  'COUPON_NOT_FOUND',
  'COUPON_INACTIVE',
  'COUPON_EXPIRED',
  'COUPON_USAGE_LIMIT',
  'COUPON_MIN_ORDER',
  'COUPON_BIRTHDAY_INELIGIBLE',
  'COUPON_EXHAUSTED',
]);

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  return digits.slice(0, 10);
}

function StepLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2B1B0C] text-[#FBF1DF] font-heading font-bold text-[11px] flex items-center justify-center">
        {n}
      </span>
      <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C]">{title}</h2>
    </div>
  );
}

function sessionIdForScope(scope: CartScope): string {
  return scope === 'buyNow' ? getBuyNowSessionId() : getSessionId();
}

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope: CartScope = searchParams.get('mode') === 'buyNow' ? 'buyNow' : 'cart';
  const queryClient = useQueryClient();
  const { cart } = useCart(scope);
  const { openCheckout, loading: rzpLoading } = useRazorpay();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/checkout');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      customerName: f.customerName || user.name,
      customerPhone: f.customerPhone || user.phone.replace(/^\+91/, ''),
    }));
  }, [user]);

  const { isChecking, serviceable } = usePincodeCheck(form.pincode);
  const { balance: walletBalance } = useWalletBalance(form.customerPhone);
  const [useWallet, setUseWallet] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);

  const items = cart?.items ?? [];
  const checkoutItems = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
  const subtotal = cart?.subtotal ?? 0;
  // Backend-computed — same resolution path checkout itself uses (see cart/service.ts's
  // computeCartPricing), so this can never drift from what actually gets charged. Previously
  // this page computed shippingFee locally and never subtracted AUTO_APPLIED offer discounts
  // at all — the Razorpay charge was always correct, but the customer never saw the price
  // move before paying, which is exactly the "total isn't going down" gap this closes.
  const shippingFee = cart?.shippingFee ?? (subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE);
  const autoAppliedDiscount = cart?.autoAppliedDiscount ?? 0;
  const preRedeemTotal = subtotal + shippingFee - autoAppliedDiscount;
  // Razorpay requires a non-zero payable amount — never let wallet cover the full total.
  const walletRedeem = useWallet && walletBalance ? Math.min(walletBalance, Math.max(preRedeemTotal - 1, 0)) : 0;
  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const total = Math.max(preRedeemTotal - walletRedeem - couponDiscount, 0);

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code || items.length === 0) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const result = await api.post<CouponPreviewResponse>('/api/coupon/preview', { code, items: checkoutItems });
      if (result.valid) {
        setAppliedCoupon({ code, discountAmount: result.discountAmount });
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(result.error);
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err instanceof ApiError ? err.body.error : 'Something went wrong. Please try again.');
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  }

  useEffect(() => {
    if (items.length > 0) trackBeginCheckout(total, items.length);
  }, [items.length, total]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return toast.error('Your cart is empty');
    if (serviceable === false) return toast.error('Sorry, we do not deliver to this pincode yet');

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
        items: checkoutItems,
        walletRedeem,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      };

      const result = await api.post<CheckoutResponse>('/api/checkout', input, {
        'x-session-id': sessionIdForScope(scope),
        Authorization: `Bearer ${getToken()}`,
      });

      await openCheckout({
        amount: result.amount,
        currency: result.currency,
        name: 'Doshhmukti',
        order_id: result.rzpOrderId,
        prefill: { name: form.customerName, email: form.customerEmail, contact: form.customerPhone },
        theme: { color: '#9C5A26' },
        handler: async (response: RazorpayResponse) => {
          trackPurchase({ orderNumber: result.orderNumber, total, itemCount: items.length });
          // Payment has already succeeded by the time this fires — this call is only
          // about getting OUR order status flipped to PAID promptly, since the Razorpay
          // webhook (the usual trigger) never reaches localhost and is fragile even in
          // prod. Best-effort: never block/fail checkout completion on this, and never
          // let a rejection reach the handleSubmit catch below (that's for /api/checkout
          // only) — the webhook remains a backstop that reconciles the order regardless.
          try {
            await api.post('/api/checkout/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }, {
              Authorization: `Bearer ${getToken()}`,
            });
          } catch {
            // Non-fatal — no toast, no rethrow. Webhook backstop will reconcile.
          }
          // Buy Now: Backend already cleared this pseudo-cart server-side on order
          // creation (safe since it's disposable) — this refetch just syncs the cache.
          // Cart scope: Backend deliberately does NOT clear the real cart pre-payment
          // (see checkout/controller.ts), so this refetch is a no-op today, but it's
          // still correct to invalidate here in case that changes post-payment-confirm.
          queryClient.invalidateQueries({ queryKey: ['cart', sessionIdForScope(scope), scope] });
          router.push(
            `/checkout/success?orderNumber=${result.orderNumber}&paymentId=${response.razorpay_payment_id}`
          );
        },
        modal: { ondismiss: () => setSubmitting(false) },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.body.error);
        if (err.body.code && COUPON_ERROR_CODES.has(err.body.code)) {
          setAppliedCoupon(null);
          setCouponInput('');
        }
      } else {
        toast.error('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  if (authLoading || !isAuthenticated) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-24 text-center font-body text-sm text-[#8A7A63]">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-2">
          Almost There
        </p>
        <h1 className="font-heading font-black tracking-tight leading-[1.1] text-2xl sm:text-3xl text-[#2B1B0C]">Checkout</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-[1.5fr_1fr] gap-6 md:gap-8 items-start">
        <div className="flex flex-col gap-8">
          <div className="bg-brand-paper border border-[#2B1B0C] rounded-2xl p-5 sm:p-6">
            <StepLabel n={1} title="Contact Details" />
            <div className="flex flex-col gap-3">
              <input
                required
                placeholder="Full Name"
                value={form.customerName}
                onChange={(e) => update('customerName', e.target.value)}
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  placeholder="Mobile Number"
                  value={form.customerPhone}
                  onChange={(e) => update('customerPhone', normalizePhone(e.target.value))}
                  className={inputClass}
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={form.customerEmail}
                  onChange={(e) => update('customerEmail', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="bg-brand-paper border border-[#2B1B0C] rounded-2xl p-5 sm:p-6">
            <StepLabel n={2} title="Shipping Address" />
            <div className="flex flex-col gap-3">
              <input
                required
                placeholder="Address Line 1"
                value={form.line1}
                onChange={(e) => update('line1', e.target.value)}
                className={inputClass}
              />
              <input
                placeholder="Address Line 2 (optional)"
                value={form.line2}
                onChange={(e) => update('line2', e.target.value)}
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  className={inputClass}
                />
                <input
                  required
                  placeholder="State"
                  value={form.state}
                  onChange={(e) => update('state', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <input
                  required
                  placeholder="Pincode"
                  value={form.pincode}
                  onChange={(e) => update('pincode', e.target.value)}
                  className={`${inputClass} w-full`}
                />
                {isChecking && <p className="text-xs text-[#8A7A63] mt-1.5 font-body">Checking serviceability...</p>}
                {serviceable === false && (
                  <p className="text-xs text-brand-alert mt-1.5 font-body font-semibold">Not serviceable at this pincode</p>
                )}
                {serviceable === true && (
                  <p className="text-xs text-brand-success mt-1.5 font-body font-semibold">✓ Deliverable to this address</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-brand-paper border border-[#2B1B0C] rounded-2xl p-5 sm:p-6 h-fit flex flex-col gap-2 md:sticky md:top-20">
          <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-2">Order Summary</h2>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto hide-scrollbar pr-1">
            {items.map((item) => (
              <div key={item.variantId} className="flex justify-between font-body text-xs text-[#6B5539]">
                <span className="truncate pr-2">
                  {item.productName} × {item.quantity}
                </span>
                <span className="flex-shrink-0">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
            {(cart?.freeItems ?? []).map((item) => (
              <div key={item.variantId} className="flex justify-between font-body text-xs text-[#9C5A26] font-semibold">
                <span className="truncate pr-2">
                  🎁 {item.productName}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                </span>
                <span className="flex-shrink-0">FREE</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-body text-sm text-[#6B5539] pt-3 border-t border-[#2B1B0C]/10">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between font-body text-sm text-[#6B5539]">
            <span>Shipping</span>
            <span>{shippingFee === 0 ? 'Free' : formatCurrency(shippingFee)}</span>
          </div>
          {autoAppliedDiscount > 0 && (
            <div className="flex justify-between font-body text-sm text-[#9C5A26] font-semibold">
              <span>Offer Discount</span>
              <span>−{formatCurrency(autoAppliedDiscount)}</span>
            </div>
          )}

          {!!walletBalance && walletBalance > 0 && (
            <label className="flex items-center justify-between gap-2 py-2 border-t border-[#2B1B0C]/10 cursor-pointer">
              <span className="flex items-center gap-2 font-body text-sm text-[#6B5539]">
                <Wallet className="w-4 h-4 text-[#9C5A26]" />
                Use wallet balance ({formatCurrency(walletBalance)})
              </span>
              <input
                type="checkbox"
                checked={useWallet}
                onChange={(e) => setUseWallet(e.target.checked)}
                className="w-4 h-4 accent-[#9C5A26]"
              />
            </label>
          )}
          {walletRedeem > 0 && (
            <div className="flex justify-between font-body text-sm text-[#9C5A26] font-semibold">
              <span>Wallet Redeemed</span>
              <span>−{formatCurrency(walletRedeem)}</span>
            </div>
          )}

          {!appliedCoupon ? (
            <div className="flex flex-col gap-1.5 py-2 border-t border-[#2B1B0C]/10">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Have a coupon code?"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setCouponError(null);
                  }}
                  className={`${inputClass} flex-1 !px-3 !py-2 text-xs uppercase`}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                  className="flex-shrink-0 font-body font-bold text-xs uppercase tracking-wide text-[#9C5A26] border border-[#9C5A26] rounded-full px-4 py-2.5 hover:bg-[#9C5A26] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {couponLoading ? 'Applying...' : 'Apply'}
                </button>
              </div>
              {couponError && <p className="text-xs text-brand-alert font-body font-semibold">{couponError}</p>}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 py-2 border-t border-[#2B1B0C]/10">
              <span className="font-body text-sm text-[#6B5539]">
                Coupon <span className="font-bold text-[#2B1B0C]">{appliedCoupon.code}</span> applied
              </span>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="flex-shrink-0 font-body text-xs font-bold uppercase tracking-wide text-[#8A7A63] hover:text-brand-alert transition-colors"
              >
                Remove
              </button>
            </div>
          )}
          {couponDiscount > 0 && (
            <div className="flex justify-between font-body text-sm text-[#9C5A26] font-semibold">
              <span>Coupon Discount</span>
              <span>−{formatCurrency(couponDiscount)}</span>
            </div>
          )}

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

          <p className="flex items-center justify-center gap-1.5 font-body text-[10px] text-[#8A7A63] mt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#9C5A26]" />
            Secured by Razorpay
          </p>
        </div>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-24 text-center font-body text-sm text-[#8A7A63]">Loading...</div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
