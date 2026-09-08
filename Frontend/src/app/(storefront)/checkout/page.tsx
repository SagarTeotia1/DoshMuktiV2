'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, ChevronDown, Ticket, Copy, Check } from 'lucide-react';
import { useCart, type CartScope } from '@/hooks/use-cart';
import { usePincodeCheck } from '@/hooks/use-pincode-check';
import { useRazorpay } from '@/hooks/use-razorpay';
import { useAuth } from '@/providers/auth-provider';
import { useAddresses, useSaveAddress, useUpdateAddress } from '@/hooks/use-addresses';
import { useShippingEstimate } from '@/hooks/use-shipping-estimate';
import { api, ApiError } from '@/lib/api-client';
import { getSessionId, getBuyNowSessionId } from '@/lib/session';
import { getToken } from '@/lib/auth';
import { formatCurrency } from '@/lib/formatters';
import { SHIPPING_FEE, FREE_SHIPPING_ABOVE } from '@/lib/constants';
import { trackBeginCheckout, trackPurchase } from '@/lib/firebase';
import type { Address, CheckoutInput, CheckoutResponse, CouponPreviewResponse, SuggestedCoupon } from '@/types/api.types';
import type { RazorpayResponse } from '@/hooks/use-razorpay';

const inputClass =
  'bg-white border border-[#2B1B0C]/40 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:border-[#9C5A26] focus:outline-none font-body placeholder:text-[#6B5539] transition-colors';

// Short one-line description for a suggested coupon row — e.g. "10% off, up to ₹50,
// on orders above ₹300". Purely presentational; the real eligibility check always
// happens server-side via /api/coupon/preview when a code is actually applied.
function couponDescription(c: SuggestedCoupon): string {
  const value = c.type === 'FLAT' ? formatCurrency(c.value) : `${c.value}%`;
  const cap = c.maxDiscount ? `, up to ${formatCurrency(c.maxDiscount)}` : '';
  const minOrder = c.minOrder ? ` on orders above ${formatCurrency(c.minOrder)}` : '';
  return `${value} off${cap}${minOrder}`;
}

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
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2B1B0C] text-[#E6D3AE] font-heading font-bold text-[11px] flex items-center justify-center">
        {n}
      </span>
      <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C]">{title}</h2>
    </div>
  );
}

function sessionIdForScope(scope: CartScope): string {
  return scope === 'buyNow' ? getBuyNowSessionId() : getSessionId();
}

type OtpStep = 'phone' | 'otp';
const RESEND_COOLDOWN_SECONDS = 120;

// Inline phone+OTP login — sits inside the checkout page itself (next to the order
// summary, which stays visible throughout) instead of bouncing the customer to a
// separate /login page and back. Mirrors the GoKwik-style "Login to continue" pattern:
// the product/price context never disappears while the customer authenticates.
// sendOtp/verifyOtp are passed down from the parent's own single useAuth() call rather
// than calling useAuth() again here — useAuth is a plain hook (its own useState), not a
// shared context, so a second call here would get its own independent isAuthenticated
// state. verifyOtp would succeed, but the parent's copy of isAuthenticated would never
// flip, and the page would silently never advance past the login card.
function InlineLogin({
  sendOtp,
  verifyOtp,
}: {
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<unknown>;
}) {
  const [step, setStep] = useState<OtpStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startResendCooldown() {
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownIntervalRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => {
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
  }, []);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{10}$/.test(phone)) return toast.error('Enter a valid 10-digit mobile number');
    if (step === 'otp' && resendCooldown > 0) return;

    setSubmitting(true);
    try {
      await sendOtp(phone);
      setStep('otp');
      startResendCooldown();
      toast.success('OTP sent');
    } catch {
      toast.error('Could not send OTP — try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(otp)) return toast.error('Enter the OTP');

    setSubmitting(true);
    try {
      await verifyOtp(phone, otp);
      // No router.push — useAuth's isAuthenticated flips true and CheckoutPageContent
      // re-renders the real form in place, same page, same scroll position.
    } catch {
      toast.error('Invalid or expired OTP');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-brand-paper border border-[#2B1B0C] rounded-2xl p-5 sm:p-6">
      <StepLabel n={1} title="Login to Continue" />
      <form onSubmit={step === 'phone' ? handlePhoneSubmit : handleOtpSubmit} className="flex flex-col gap-3">
        <input
          type="tel"
          inputMode="numeric"
          autoFocus={step === 'phone'}
          disabled={step === 'otp'}
          value={phone}
          onChange={(e) => setPhone(normalizePhone(e.target.value))}
          placeholder="10-digit mobile number"
          className={`${inputClass} disabled:opacity-60 disabled:bg-[#2B1B0C]/5`}
        />

        {step === 'otp' && (
          <>
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setOtp('');
              }}
              className="font-body text-xs text-[#8A7A63] hover:text-[#2B1B0C] transition-colors self-start -mt-1"
            >
              Change phone number
            </button>
            <p className="font-body text-xs text-[#8A7A63] mb-1">OTP sent to +91 {phone}</p>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter OTP"
              className={inputClass}
            />
            <button
              type="button"
              onClick={handlePhoneSubmit}
              disabled={resendCooldown > 0 || submitting}
              className="font-body text-xs text-[#8A7A63] hover:text-[#2B1B0C] transition-colors self-start disabled:opacity-50 disabled:hover:text-[#8A7A63]"
            >
              {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
            </button>
          </>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="brutal-border bg-[#2B1B0C] text-white rounded-lg px-6 py-3.5 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200 disabled:opacity-50 mt-1"
        >
          {step === 'phone'
            ? submitting
              ? 'Sending...'
              : 'Send OTP'
            : submitting
              ? 'Verifying...'
              : 'Verify & Continue'}
        </button>
      </form>
    </div>
  );
}

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope: CartScope = searchParams.get('mode') === 'buyNow' ? 'buyNow' : 'cart';
  const queryClient = useQueryClient();
  const { cart } = useCart(scope);
  const { openCheckout, loading: rzpLoading } = useRazorpay();
  const { user, loading: authLoading, isAuthenticated, sendOtp, verifyOtp } = useAuth();
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
    if (!user) return;
    setForm((f) => ({
      ...f,
      customerName: f.customerName || user.name || '',
      customerPhone: f.customerPhone || user.phone.replace(/^\+91/, ''),
    }));
  }, [user]);

  const { isChecking, serviceable } = usePincodeCheck(form.pincode);

  // Saved-address book — a returning customer sees their last delivery address by
  // default instead of retyping name/phone/address every single order. Receiver phone
  // pre-fills to the login number (most orders ship to whoever's placing them) but stays
  // a plain editable field — no separate "same as login" toggle to fuss with.
  const { data: savedAddresses } = useAddresses(isAuthenticated);
  const saveAddress = useSaveAddress();
  const updateAddress = useUpdateAddress();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  // Set while editing an existing saved address — Pay Now PATCHes this id instead of
  // creating a new row. null means the open form (if any) is either a fresh "Add New
  // Address" or just the summary/picker, not an edit.
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  // True only in the sliver of time between clicking "Edit Address" (with more than one
  // saved address) and actually picking which one — shows the list with nothing else.
  const [pickingAddressToEdit, setPickingAddressToEdit] = useState(false);
  // Distinguishes "no addresses saved yet" from "still loading" — avoids a flash of the
  // blank form before the saved-address fetch resolves.
  const addressesLoaded = savedAddresses !== undefined;

  // Once saved addresses load, auto-select the default one (list is sorted
  // default-first) instead of showing a blank form to a returning customer.
  useEffect(() => {
    if (!savedAddresses || savedAddresses.length === 0 || selectedAddressId !== null) return;
    applySavedAddress(savedAddresses[0]!);
  }, [savedAddresses]); // eslint-disable-line react-hooks/exhaustive-deps

  function applySavedAddress(addr: Address) {
    setSelectedAddressId(addr.id);
    setEditingAddressId(null);
    setAddressFormOpen(false);
    setPickingAddressToEdit(false);
    setForm((f) => ({
      ...f,
      customerName: addr.name,
      customerPhone: addr.receiverPhone.replace(/^\+91/, ''),
      line1: addr.line1,
      line2: addr.line2 ?? '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    }));
  }

  // Opens the form pre-filled with an existing saved address, in edit mode — Pay Now
  // will PATCH this address instead of creating a new one. Also makes it the active
  // address for this order, so picking one to edit doubles as "use this one."
  function startEditAddress(addr: Address) {
    setSelectedAddressId(addr.id);
    setEditingAddressId(addr.id);
    setAddressFormOpen(true);
    setPickingAddressToEdit(false);
    setForm((f) => ({
      ...f,
      customerName: addr.name,
      customerPhone: addr.receiverPhone.replace(/^\+91/, ''),
      line1: addr.line1,
      line2: addr.line2 ?? '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    }));
  }

  // "Edit Address" button — skips straight to the edit form when there's only one
  // saved address (nothing to pick), otherwise shows the list first.
  function handleEditClick() {
    if (!savedAddresses || savedAddresses.length === 0) return startNewAddress();
    if (savedAddresses.length === 1) return startEditAddress(savedAddresses[0]!);
    setPickingAddressToEdit(true);
    setAddressFormOpen(true);
  }

  function startNewAddress() {
    setSelectedAddressId(null);
    setEditingAddressId(null);
    setAddressFormOpen(true);
    setPickingAddressToEdit(false);
    setForm((f) => ({
      ...f,
      customerName: user?.name ?? '',
      customerPhone: user?.phone.replace(/^\+91/, '') ?? '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
    }));
  }

  const selectedAddress = savedAddresses?.find((a) => a.id === selectedAddressId) ?? null;

  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);

  // Admin-curated (Coupon.showInSuggestions) — a small set of codes nudged as tappable
  // chips right where the customer is already looking for a code, instead of making them
  // go find one. Fetched once on mount; failure just means no chips, never blocks checkout.
  const [suggestedCoupons, setSuggestedCoupons] = useState<SuggestedCoupon[]>([]);
  const [couponPanelOpen, setCouponPanelOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  useEffect(() => {
    api
      .get<SuggestedCoupon[]>('/api/coupons/suggestions')
      .then(setSuggestedCoupons)
      .catch(() => setSuggestedCoupons([]));
  }, []);

  async function handleCopyCode(code: string) {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      // Clipboard denied/unavailable — the code is still visible in the row to copy by hand.
    }
  }

  const items = cart?.items ?? [];
  const checkoutItems = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
  const subtotal = cart?.subtotal ?? 0;

  // The cart preview only ever has an origin-to-origin shipping estimate (no destination
  // known pre-checkout). Once a real 6-digit pincode is entered here, re-quote against
  // it live — the displayed fee then updates to the actual charge instead of sitting on
  // that earlier guess. (The real order charge was always computed server-side against
  // the real pincode regardless — this only affects what's *shown* before paying.)
  const cartWeightGrams = items.reduce((sum, item) => sum + (item.weight ?? 500) * item.quantity, 0);
  const liveShipping = useShippingEstimate(
    subtotal,
    cartWeightGrams,
    /^\d{6}$/.test(form.pincode) ? form.pincode : undefined
  );

  // Backend-computed — same resolution path checkout itself uses (see cart/service.ts's
  // computeCartPricing), so this can never drift from what actually gets charged. Previously
  // this page computed shippingFee locally and never subtracted AUTO_APPLIED offer discounts
  // at all — the Razorpay charge was always correct, but the customer never saw the price
  // move before paying, which is exactly the "total isn't going down" gap this closes.
  const shippingFee =
    liveShipping.data?.fee ?? cart?.shippingFee ?? (subtotal >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE);
  const shippingFeeOriginal = liveShipping.data?.originalFee ?? cart?.shippingFeeOriginal ?? shippingFee;
  // A real pincode hasn't been entered yet means shippingFee/shippingFeeOriginal above are
  // still riding the cart-preview's origin-to-origin guess (see useShippingEstimate above) —
  // never show that guess as if it were the real charge. Free-shipping orders are exempt:
  // ₹0 is correct regardless of pincode, no guess involved.
  const hasResolvedPincodeRate = subtotal >= FREE_SHIPPING_ABOVE || (/^\d{6}$/.test(form.pincode) && !!liveShipping.data);
  const autoAppliedDiscount = cart?.autoAppliedDiscount ?? 0;
  const preDiscountTotal = subtotal + shippingFee - autoAppliedDiscount;
  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const total = Math.max(preDiscountTotal - couponDiscount, 0);
  // Inclusive breakup of subtotal (product price already includes GST — never an added
  // charge), same math the invoice PDF uses. 0 when nothing in the cart carries a GST rate.
  const gstAmount = cart?.gstAmount ?? 0;
  const taxableValue = cart?.taxableValue ?? subtotal;

  async function handleApplyCoupon(codeOverride?: string) {
    const code = (codeOverride ?? couponInput).trim();
    if (!code || items.length === 0) return;
    if (codeOverride) setCouponInput(codeOverride);
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

    // Save the address the moment "Pay Now" is pressed, not after payment succeeds —
    // the customer typed/changed a real address either way, and if the payment itself
    // fails or gets abandoned they still want it remembered for the retry, not lost.
    // Fire-and-forget: never block checkout on this. Three cases: editing an existing
    // saved address (PATCH it), a freshly-typed one (create it), or an unchanged saved
    // address already picked from the list (nothing to save).
    if (editingAddressId) {
      updateAddress.mutate({
        id: editingAddressId,
        name: form.customerName,
        receiverPhone: form.customerPhone,
        line1: form.line1,
        line2: form.line2 || undefined,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        setDefault: true,
      });
    } else if (!selectedAddressId) {
      saveAddress.mutate({
        name: form.customerName,
        receiverPhone: form.customerPhone,
        line1: form.line1,
        line2: form.line2 || undefined,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        setDefault: true,
      });
    }

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
          // Address is already saved (see handleSubmit, fires the moment Pay Now was
          // pressed) — nothing address-related left to do here.
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

  if (authLoading) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-24 text-center font-body text-sm text-[#8A7A63]">Loading...</div>;
  }

  // Shared between the logged-out and logged-in layouts below — order context (items,
  // price, coupon) stays visible and identical either way. Only the Pay Now button is
  // conditional: submitting before authenticating has nothing to charge yet.
  const summaryCard = (
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
        {!hasResolvedPincodeRate ? (
          <span className="text-[#8A7A63] text-xs">Enter pincode</span>
        ) : shippingFee === 0 ? (
          shippingFeeOriginal > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="line-through text-[#8A7A63]">{formatCurrency(shippingFeeOriginal)}</span>
              <span className="font-semibold text-brand-success">FREE</span>
            </span>
          ) : (
            <span>Free</span>
          )
        ) : (
          formatCurrency(shippingFee)
        )}
      </div>
      {autoAppliedDiscount > 0 && (
        <div className="flex justify-between font-body text-sm text-[#9C5A26] font-semibold">
          <span>Offer Discount</span>
          <span>−{formatCurrency(autoAppliedDiscount)}</span>
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
              onClick={() => handleApplyCoupon()}
              disabled={couponLoading || !couponInput.trim()}
              className="flex-shrink-0 font-body font-bold text-xs uppercase tracking-wide text-[#9C5A26] border border-[#9C5A26] rounded-full px-4 py-2.5 hover:bg-[#9C5A26] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {couponLoading ? 'Applying...' : 'Apply'}
            </button>
          </div>
          {couponError && <p className="text-xs text-brand-alert font-body font-semibold">{couponError}</p>}

          {suggestedCoupons.length > 0 && (
            <div className="mt-0.5">
              <button
                type="button"
                onClick={() => setCouponPanelOpen((v) => !v)}
                className="flex items-center gap-1.5 font-body text-xs font-bold text-[#9C5A26]"
              >
                <Ticket className="w-3.5 h-3.5" />
                {couponPanelOpen ? 'Hide available offers' : `View available offers (${suggestedCoupons.length})`}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${couponPanelOpen ? 'rotate-180' : ''}`} />
              </button>

              {couponPanelOpen && (
                <div className="brutal-border mt-2 rounded-lg bg-[#FFFDF8] divide-y divide-[#2B1B0C]/10 overflow-hidden">
                  {suggestedCoupons.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-black text-xs tracking-wide text-[#2B1B0C]">{c.code}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(c.code)}
                            className="text-[#8A7A63] hover:text-[#9C5A26] transition-colors"
                            title="Copy code"
                          >
                            {copiedCode === c.code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <p className="font-body text-[11px] text-[#8A7A63] mt-0.5 truncate">{couponDescription(c)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplyCoupon(c.code)}
                        disabled={couponLoading}
                        className="flex-shrink-0 font-body font-bold text-[10px] uppercase tracking-wide text-[#9C5A26] border border-[#9C5A26] rounded-full px-3 py-1.5 hover:bg-[#9C5A26] hover:text-white transition-colors disabled:opacity-50"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
        <span>
          {hasResolvedPincodeRate
            ? formatCurrency(total)
            : formatCurrency(Math.max(subtotal - autoAppliedDiscount - couponDiscount, 0))}
        </span>
      </div>
      {!hasResolvedPincodeRate && (
        <p className="font-body text-[10px] text-[#8A7A63] text-right -mt-1">
          Add item worth {formatCurrency(Math.max(FREE_SHIPPING_ABOVE - subtotal, 0))} more and claim free delivery.
        </p>
      )}
      {hasResolvedPincodeRate && gstAmount > 0 && (
        <p className="font-body text-[11px] text-[#8A7A63] text-right -mt-1">
          Inclusive of GST: {formatCurrency(gstAmount)} (Taxable {formatCurrency(taxableValue)} + GST {formatCurrency(gstAmount)})
        </p>
      )}

      {isAuthenticated ? (
        <>
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
        </>
      ) : (
        <p className="font-body text-xs text-[#8A7A63] text-center mt-4">Log in to continue to payment</p>
      )}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-2">
          Almost There
        </p>
        <h1 className="font-heading font-black tracking-tight leading-[1.1] text-2xl sm:text-3xl text-[#2B1B0C]">Checkout</h1>
      </div>

      {!isAuthenticated ? (
        <div className="grid md:grid-cols-[1.5fr_1fr] gap-6 md:gap-8 items-start">
          <div className="flex flex-col gap-8">
            <InlineLogin sendOtp={sendOtp} verifyOtp={verifyOtp} />
          </div>
          {summaryCard}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid md:grid-cols-[1.5fr_1fr] gap-6 md:gap-8 items-start">
          <div className="flex flex-col gap-8">
            <div className="bg-brand-paper border border-[#2B1B0C] rounded-2xl p-5 sm:p-6">
              <StepLabel n={2} title="Delivery Details" />

              {!addressFormOpen && selectedAddress ? (
                // Returning customer — their saved default address, shown as a summary
                // instead of an editable form so they don't retype it every order.
                <div className="flex flex-col gap-1.5">
                  <p className="font-body text-sm font-bold text-[#2B1B0C]">{selectedAddress.name}</p>
                  <p className="font-body text-sm text-[#6B5539]">+91 {selectedAddress.receiverPhone.replace(/^\+91/, '')}</p>
                  <p className="font-body text-sm text-[#6B5539] leading-relaxed">
                    {selectedAddress.line1}
                    {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}
                    <br />
                    {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <button
                      type="button"
                      onClick={handleEditClick}
                      className="self-start font-body text-xs font-bold uppercase tracking-wide text-[#9C5A26] hover:text-[#6B3D19] transition-colors"
                    >
                      Edit Address
                    </button>
                    <button
                      type="button"
                      onClick={startNewAddress}
                      className="self-start font-body text-xs font-bold uppercase tracking-wide text-[#8A7A63] hover:text-[#2B1B0C] transition-colors"
                    >
                      Add New Address
                    </button>
                  </div>
                </div>
              ) : pickingAddressToEdit ? (
                // "Edit Address" with more than one saved address — pick which one first.
                // Picking it opens that address's form pre-filled (startEditAddress), so
                // selecting and editing are the same click, not two separate steps.
                <div className="flex flex-col gap-2">
                  {savedAddresses!.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => startEditAddress(addr)}
                      className="flex flex-col items-start text-left border border-[#2B1B0C]/20 hover:border-[#9C5A26] rounded-xl px-3 py-2.5 transition-colors"
                    >
                      <span className="font-body text-sm font-bold text-[#2B1B0C]">{addr.name}</span>
                      <span className="font-body text-xs text-[#6B5539]">
                        {addr.line1}, {addr.city}, {addr.state} {addr.pincode}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPickingAddressToEdit(false);
                      setAddressFormOpen(false);
                    }}
                    className="self-start font-body text-xs font-bold uppercase tracking-wide text-[#8A7A63] hover:text-[#2B1B0C] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                      <input
                        required
                        placeholder="Full Name"
                        value={form.customerName}
                        onChange={(e) => update('customerName', e.target.value)}
                        className={inputClass}
                      />
                      <input
                        required
                        type="tel"
                        inputMode="numeric"
                        placeholder="Receiver's Phone Number"
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
                      <div>
                        <input
                          required
                          placeholder="Pincode"
                          inputMode="numeric"
                          value={form.pincode}
                          onChange={(e) => update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className={`${inputClass} w-full`}
                        />
                        {isChecking && <p className="text-xs text-[#8A7A63] mt-1.5 font-body">Checking serviceability...</p>}
                        {serviceable === false && (
                          <p className="text-xs text-brand-alert mt-1.5 font-body font-semibold">Not serviceable at this pincode</p>
                        )}
                        {serviceable === true && (
                          <p className="text-xs text-brand-success mt-1.5 font-body font-semibold">✓ Deliverable to this address</p>
                        )}
                        {/* Never show a shipping number before it's actually quoted for THIS
                            pincode — the cart-preview figure is an origin-to-origin guess and
                            showing it here reads as a real price. Only liveShipping.data (a
                            resolved quote for the exact digits in form.pincode) counts as real. */}
                        <p className="text-[10px] text-[#8A7A63] mt-1.5 font-body">
                          {subtotal >= FREE_SHIPPING_ABOVE
                            ? `Orders above ${formatCurrency(FREE_SHIPPING_ABOVE)} ship free.`
                            : hasResolvedPincodeRate
                            ? `Delivery charges are added for orders below ${formatCurrency(FREE_SHIPPING_ABOVE)} (${formatCurrency(shippingFeeOriginal)} for this order).`
                            : `Add item worth ${formatCurrency(Math.max(FREE_SHIPPING_ABOVE - subtotal, 0))} more and claim free delivery.`}
                        </p>
                      </div>
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
                </div>
              )}
            </div>
          </div>

          {summaryCard}
        </form>
      )}
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
