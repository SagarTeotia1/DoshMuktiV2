'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCart, type CartScope } from '@/hooks/use-cart';
import { usePincodeCheck } from '@/hooks/use-pincode-check';
import { useRazorpay, type RazorpayResponse } from '@/hooks/use-razorpay';
import { useAuth } from '@/providers/auth-provider';
import { useAddresses, useSaveAddress, useUpdateAddress } from '@/hooks/use-addresses';
import { useShippingEstimate } from '@/hooks/use-shipping-estimate';
import { api, ApiError } from '@/lib/api-client';
import { getSessionId, getBuyNowSessionId } from '@/lib/session';
import { getToken } from '@/lib/auth';
import { formatDeliveryEstimate } from '@/lib/formatters';
import { SHIPPING_FEE, FREE_SHIPPING_ABOVE, COD_FEE, MAX_COD_ORDER_TOTAL } from '@/lib/constants';
import { trackBeginCheckout, trackAddPaymentInfo } from '@/lib/analytics';
import type {
  Address,
  CheckoutInput,
  PaymentMethod,
  CheckoutResponse,
  CouponPreviewResponse,
  SuggestedCoupon,
} from '@/types/api.types';

const COUPON_ERROR_CODES = new Set([
  'COUPON_NOT_FOUND',
  'COUPON_INACTIVE',
  'COUPON_EXPIRED',
  'COUPON_USAGE_LIMIT',
  'COUPON_MIN_ORDER',
  'COUPON_BIRTHDAY_INELIGIBLE',
  'COUPON_EXHAUSTED',
]);

export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  return digits.slice(0, 10);
}

function sessionIdForScope(scope: CartScope): string {
  return scope === 'buyNow' ? getBuyNowSessionId() : getSessionId();
}

interface GuestAddress {
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

const EMPTY_FORM = {
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pincode: '',
};

// All checkout state + logic, shared by the /checkout page (cart) and the Buy Now drawer.
// Guest-friendly: no login is required to pay. The buyer is identified by the phone they
// type; a returning number gets its last address pre-filled.
export function useCheckout(scope: CartScope, opts?: { onNavigate?: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { cart, updateQuantity, isUpdating } = useCart(scope);
  const { openCheckout, loading: rzpLoading } = useRazorpay();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [codWarningOpen, setCodWarningOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      customerName: f.customerName || user.name || '',
      customerPhone: f.customerPhone || user.phone.replace(/^\+91/, ''),
    }));
  }, [user]);

  const { isChecking, serviceable } = usePincodeCheck(form.pincode);

  // ── Saved addresses (logged-in customers only) ───────────────────────────────────────
  const { data: savedAddresses } = useAddresses(isAuthenticated);
  const saveAddress = useSaveAddress();
  const updateAddress = useUpdateAddress();
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [pickingAddressToEdit, setPickingAddressToEdit] = useState(false);
  const addressesLoaded = savedAddresses !== undefined;

  useEffect(() => {
    if (!savedAddresses || savedAddresses.length === 0 || selectedAddressId !== null) return;
    applySavedAddress(savedAddresses[0]!);
  }, [savedAddresses]); // eslint-disable-line react-hooks/exhaustive-deps

  function fillFromAddress(addr: Address) {
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

  function applySavedAddress(addr: Address) {
    setSelectedAddressId(addr.id);
    setEditingAddressId(null);
    setAddressFormOpen(false);
    setPickingAddressToEdit(false);
    fillFromAddress(addr);
  }

  function startEditAddress(addr: Address) {
    setSelectedAddressId(addr.id);
    setEditingAddressId(addr.id);
    setAddressFormOpen(true);
    setPickingAddressToEdit(false);
    fillFromAddress(addr);
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

  function handleEditClick() {
    if (!savedAddresses || savedAddresses.length === 0) return startNewAddress();
    if (savedAddresses.length === 1) return startEditAddress(savedAddresses[0]!);
    setPickingAddressToEdit(true);
    setAddressFormOpen(true);
  }

  const selectedAddress = savedAddresses?.find((a) => a.id === selectedAddressId) ?? null;

  // ── Guest prefill: known number → last used address ─────────────────────────────────
  // Fires once per distinct 10-digit number, only for guests, and only fills fields the
  // buyer hasn't typed into yet — never overwrites their edits.
  // Fields the buyer typed themselves are never touched; fields we filled earlier are
  // replaced when they switch to a different number, and cleared if that number is unknown.
  const lookedUpRef = useRef<string | null>(null);
  const [addressPrefilled, setAddressPrefilled] = useState(false);
  const touchedRef = useRef<Set<string>>(new Set());
  const autoFilledRef = useRef(false);
  const hasSavedAddresses = (savedAddresses?.length ?? 0) > 0;
  useEffect(() => {
    const phone = form.customerPhone;
    if (!/^[6-9]\d{9}$/.test(phone)) {
      lookedUpRef.current = null;
      return;
    }
    // Logged-in users with saved addresses use those instead.
    if ((isAuthenticated && hasSavedAddresses) || lookedUpRef.current === phone) return;
    lookedUpRef.current = phone;
    let cancelled = false;
    api
      .get<{ address: GuestAddress | null }>(`/api/addresses/lookup?phone=${phone}`, undefined, 0)
      .then(({ address }) => {
        if (cancelled) return;
        const fields = address
          ? {
              customerName: address.name,
              line1: address.line1,
              line2: address.line2 ?? '',
              city: address.city,
              state: address.state,
              pincode: address.pincode,
            }
          : { customerName: '', line1: '', line2: '', city: '', state: '', pincode: '' };
        // Unknown number: only wipe what a previous auto-fill put there.
        if (!address && !autoFilledRef.current) return;
        setForm((f) => {
          if (f.customerPhone !== phone) return f;
          const next = { ...f };
          for (const [k, v] of Object.entries(fields)) {
            if (!touchedRef.current.has(k)) (next as Record<string, string>)[k] = v;
          }
          return next;
        });
        autoFilledRef.current = !!address;
        setAddressPrefilled(!!address);
      })
      .catch(() => {
        // Rate-limited / network blip: allow a retry next time the number is re-entered.
        if (lookedUpRef.current === phone) lookedUpRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [form.customerPhone, isAuthenticated, hasSavedAddresses]);

  // ── Payment method + coupons ────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PREPAID');
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
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
      // Clipboard denied/unavailable — the code is still visible to copy by hand.
    }
  }

  const items = cart?.items ?? [];
  const checkoutItems = items.map((i) => ({ variantId: i.variantId, quantity: i.quantity }));
  const subtotal = cart?.subtotal ?? 0;

  // Free-gift lines still ship — count their weight like initiateCheckout does.
  const cartWeightGrams =
    items.reduce((sum, item) => sum + (item.weight ?? 500) * item.quantity, 0) +
    (cart?.freeItems ?? []).reduce((sum, item) => sum + item.weight * item.quantity, 0);
  const destPincode = /^\d{6}$/.test(form.pincode) ? form.pincode : undefined;
  const prepaidShipping = useShippingEstimate(subtotal, cartWeightGrams, destPincode, 'PREPAID');
  const codShipping = useShippingEstimate(subtotal, cartWeightGrams, destPincode, 'COD');
  const liveShipping = paymentMethod === 'COD' ? codShipping : prepaidShipping;

  const shippingFee =
    liveShipping.data?.fee ?? cart?.shippingFee ?? (subtotal > FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE);
  const shippingFeeOriginal = liveShipping.data?.originalFee ?? cart?.shippingFeeOriginal ?? shippingFee;
  const hasResolvedPincodeRate =
    subtotal > FREE_SHIPPING_ABOVE || (/^\d{6}$/.test(form.pincode) && !!liveShipping.data);
  const optionResolved = (est: typeof prepaidShipping) =>
    subtotal > FREE_SHIPPING_ABOVE || (!!destPincode && !!est.data);
  const deliveryEstimate = formatDeliveryEstimate({
    shipment: null,
    estimatedDeliveryWindow: liveShipping.data?.estimatedDeliveryWindow ?? null,
  });
  const autoAppliedDiscount = cart?.autoAppliedDiscount ?? 0;
  const preDiscountTotal = subtotal + shippingFee - autoAppliedDiscount;
  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const isCod = paymentMethod === 'COD';
  // Flat COD charge on every COD order — Backend's computeCodFee is authoritative.
  const codFee = isCod ? COD_FEE : 0;
  const total = Math.max(preDiscountTotal + codFee - couponDiscount, 0);
  const totalWithFee = (fee: number) => Math.max(subtotal + fee - autoAppliedDiscount - couponDiscount, 0);
  const prepaidOptionTotal = totalWithFee(prepaidShipping.data?.fee ?? shippingFee);
  const codOptionFee = COD_FEE;
  const codOptionTotal = totalWithFee(codShipping.data?.fee ?? shippingFee) + codOptionFee;
  const codUnavailable = codOptionTotal > MAX_COD_ORDER_TOTAL;
  // What the customer keeps by paying online instead of COD (COD charge + any shipping gap).
  const prepaidSavings =
    optionResolved(prepaidShipping) && optionResolved(codShipping)
      ? Math.max(codOptionTotal - prepaidOptionTotal, 0)
      : COD_FEE;
  useEffect(() => {
    if (codUnavailable && paymentMethod === 'COD') setPaymentMethod('PREPAID');
  }, [codUnavailable, paymentMethod]);
  const gstAmount = cart?.gstAmount ?? 0;
  const taxableValue = cart?.taxableValue ?? subtotal;
  const savings = cart?.savings ?? 0;

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
    if (key !== 'customerPhone') touchedRef.current.add(key as string);
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ── Submit ──────────────────────────────────────────────────────────────────────────
  // COD is intercepted once with a "pay online & save ₹X" warning; confirmCod=true is the
  // customer's explicit "continue with COD".
  async function submit(confirmCod = false, methodOverride?: PaymentMethod) {
    const method = methodOverride ?? paymentMethod;
    const codSelected = method === 'COD';
    if (items.length === 0) return toast.error('Your cart is empty');
    // Last line of defence for every entry point (drawer, /checkout, COD modal buttons):
    // `required` alone accepts "   ", so check trimmed values here.
    if (!/^[6-9]\d{9}$/.test(form.customerPhone)) return toast.error('Enter a valid 10-digit mobile number');
    if (form.customerName.trim().length < 2) return toast.error('Enter your full name');
    if (form.line1.trim().length < 5) return toast.error('Enter your house no., street and area');
    if (form.city.trim().length < 2 || form.state.trim().length < 2) return toast.error('Enter your city and state');
    if (!/^\d{6}$/.test(form.pincode)) return toast.error('Enter a valid 6-digit pincode');
    if (!hasResolvedPincodeRate) return toast.error('Enter your pincode to see the delivery charge');
    if (serviceable === false) return toast.error('Sorry, we do not deliver to this pincode yet');
    if (codSelected && !confirmCod) {
      setCodWarningOpen(true);
      return;
    }
    setCodWarningOpen(false);
    setSubmitting(true);

    // Logged-in customers keep their address book in sync; guest addresses are saved
    // server-side by /api/checkout itself. Fire-and-forget — never blocks payment.
    if (isAuthenticated) {
      const addr = {
        name: form.customerName,
        receiverPhone: form.customerPhone,
        line1: form.line1,
        line2: form.line2 || undefined,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        setDefault: true,
      };
      if (editingAddressId) updateAddress.mutate({ id: editingAddressId, ...addr });
      else if (!selectedAddressId) saveAddress.mutate(addr);
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
        paymentMethod: method,
      };

      const token = getToken();
      const result = await api.post<CheckoutResponse>('/api/checkout', input, {
        'x-session-id': sessionIdForScope(scope),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      });

      trackAddPaymentInfo(total);

      const goToSuccess = (path: string) => {
        queryClient.invalidateQueries({ queryKey: ['cart', sessionIdForScope(scope), scope] });
        opts?.onNavigate?.();
        router.push(path);
      };

      // COD: Backend already confirmed the order — straight to success.
      if (!result.rzpOrderId) {
        goToSuccess(`/checkout/success?t=${result.publicToken}`);
        return;
      }

      await openCheckout({
        amount: result.amount,
        currency: result.currency,
        name: 'Doshmukti',
        order_id: result.rzpOrderId,
        prefill: { name: form.customerName, email: form.customerEmail, contact: form.customerPhone },
        theme: { color: '#9C5A26' },
        handler: async (response: RazorpayResponse) => {
          // Best-effort: flip our order to PAID promptly; the webhook is the backstop and
          // /checkout/success retries. Purchase conversion fires from the success page.
          try {
            await api.post('/api/checkout/verify', {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }, { 'x-session-id': sessionIdForScope(scope) });
          } catch (err) {
            console.error('[checkout] /api/checkout/verify failed — webhook backstop will reconcile', err);
          }
          goToSuccess(`/checkout/success?t=${result.publicToken}&paymentId=${response.razorpay_payment_id}`);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submit(false);
  }

  return {
    // data
    cart, items, subtotal, savings, gstAmount, taxableValue, authLoading, isAuthenticated,
    // form
    form, update, isChecking, serviceable, addressPrefilled,
    // saved addresses (logged-in)
    savedAddresses, addressesLoaded, selectedAddress, selectedAddressId, addressFormOpen, setAddressFormOpen,
    pickingAddressToEdit, setPickingAddressToEdit, startEditAddress, startNewAddress, handleEditClick,
    // cart
    updateQuantity, isUpdating,
    // pricing
    shippingFee, shippingFeeOriginal, hasResolvedPincodeRate, optionResolved, deliveryEstimate,
    autoAppliedDiscount, couponDiscount, codFee, total, prepaidShipping, codShipping,
    prepaidOptionTotal, codOptionFee, codOptionTotal, codUnavailable, prepaidSavings,
    // payment
    paymentMethod, setPaymentMethod, isCod,
    // coupons
    couponInput, setCouponInput, couponLoading, couponError, setCouponError, appliedCoupon,
    suggestedCoupons, couponPanelOpen, setCouponPanelOpen, copiedCode,
    handleApplyCoupon, handleRemoveCoupon, handleCopyCode,
    // submit
    submitting, rzpLoading, handleSubmit, submit, codWarningOpen, setCodWarningOpen,
  };
}
