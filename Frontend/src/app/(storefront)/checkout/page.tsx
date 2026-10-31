'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, ChevronDown, Ticket, Copy, Check, Minus, Plus } from 'lucide-react';
import type { CartScope } from '@/hooks/use-cart';
import { useCheckout, normalizePhone } from '@/hooks/use-checkout';
import { CodWarningModal } from '@/components/checkout/CodWarningModal';
import { formatCurrency } from '@/lib/formatters';
import { FREE_SHIPPING_ABOVE, MAX_COD_ORDER_TOTAL } from '@/lib/constants';
import type { SuggestedCoupon } from '@/types/api.types';

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

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const scope: CartScope = searchParams.get('mode') === 'buyNow' ? 'buyNow' : 'cart';
  const {
    items, subtotal, savings, gstAmount, taxableValue, authLoading, isAuthenticated, cart,
    form, update, isChecking, serviceable, addressPrefilled,
    savedAddresses, selectedAddress, addressFormOpen, setAddressFormOpen,
    pickingAddressToEdit, setPickingAddressToEdit, startEditAddress, startNewAddress, handleEditClick,
    updateQuantity, isUpdating,
    shippingFee, shippingFeeOriginal, hasResolvedPincodeRate, optionResolved, deliveryEstimate,
    autoAppliedDiscount, couponDiscount, codFee, total, prepaidShipping, codShipping,
    prepaidOptionTotal, codOptionFee, codOptionTotal, codUnavailable, prepaidSavings,
    paymentMethod, setPaymentMethod, isCod,
    couponInput, setCouponInput, couponLoading, couponError, setCouponError, appliedCoupon,
    suggestedCoupons, couponPanelOpen, setCouponPanelOpen, copiedCode,
    handleApplyCoupon, handleRemoveCoupon, handleCopyCode,
    submitting, rzpLoading, handleSubmit, submit, codWarningOpen, setCodWarningOpen,
  } = useCheckout(scope);

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
          <div key={item.variantId} className="flex items-center justify-between gap-2 font-body text-xs text-[#6B5539]">
            <span className="truncate flex-1">{item.productName}</span>
            <div className="flex items-center gap-1 flex-shrink-0 border border-[#2B1B0C]/20 rounded-full">
              <button
                type="button"
                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                disabled={isUpdating}
                className="w-5 h-5 flex items-center justify-center hover:bg-[#F6E4C2] disabled:opacity-50 transition-colors rounded-full"
                aria-label="Decrease quantity"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <span className="w-4 text-center tabular-nums font-semibold">{item.quantity}</span>
              <button
                type="button"
                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                disabled={isUpdating || item.quantity >= item.maxStock}
                className="w-5 h-5 flex items-center justify-center hover:bg-[#F6E4C2] disabled:opacity-50 transition-colors rounded-full"
                aria-label="Increase quantity"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
            <span className="flex-shrink-0 w-16 text-right">
              <span className="block">{formatCurrency(item.price * item.quantity)}</span>
              {item.compareAtPrice && item.compareAtPrice > item.price && (
                <span className="block text-[10px] text-[#8A7A63] line-through">
                  {formatCurrency(item.compareAtPrice * item.quantity)}
                </span>
              )}
            </span>
          </div>
        ))}
        {(cart?.freeItems ?? []).map((item) => (
          <div key={item.variantId} className="flex justify-between font-body text-xs text-[#9C5A26] font-semibold">
            <span className="truncate pr-2">
              🎁 {item.sku.includes('ATTAR') || item.productName.toUpperCase().includes('ATTAR') ? 'FREE ATTAR' : item.productName}
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
      {savings > 0 && (
        <div className="flex justify-between font-body text-sm text-brand-success font-semibold">
          <span>You Saved</span>
          <span>{formatCurrency(savings)}</span>
        </div>
      )}
      <div className="flex justify-between font-body text-sm text-[#6B5539]">
        <span>Shipping & Packaging</span>
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
      {codFee > 0 && (
        <div className="flex justify-between font-body text-sm text-[#6B5539]">
          <span>COD Charges</span>
          <span>{formatCurrency(codFee)}</span>
        </div>
      )}
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
      {deliveryEstimate && (
        <div className="flex justify-between gap-3 font-body text-sm text-[#6B5539]">
          <span>Estimated delivery</span>
          <span className="font-semibold text-[#2B1B0C] text-right">{deliveryEstimate}</span>
        </div>
      )}
      <div className="flex flex-col gap-2 pt-1" role="radiogroup" aria-label="Payment method">
        {([
          {
            id: 'PREPAID',
            title: 'Pay online',
            sub: `UPI · Cards · Netbanking · Save ${formatCurrency(prepaidSavings)}`,
            badge: optionResolved(prepaidShipping) ? formatCurrency(prepaidOptionTotal) : null,
          },
          {
            id: 'COD',
            title: 'Cash on Delivery',
            sub: codUnavailable
              ? `Available on orders up to ${formatCurrency(MAX_COD_ORDER_TOTAL)}`
              : `Pay when your order arrives · includes ${formatCurrency(codOptionFee)} COD charges`,
            badge: !codUnavailable && optionResolved(codShipping) ? formatCurrency(codOptionTotal) : null,
          },
        ] as const).map((opt) => {
          const optDisabled = opt.id === 'COD' && codUnavailable;
          return (
          <label
            key={opt.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
              optDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            } ${paymentMethod === opt.id ? 'border-[#9C5A26] bg-[#9C5A26]/5' : 'border-[#2B1B0C]/15'}`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value={opt.id}
              checked={paymentMethod === opt.id}
              disabled={optDisabled}
              onChange={() => setPaymentMethod(opt.id)}
              className="accent-[#9C5A26]"
            />
            <span className="flex flex-col flex-1 min-w-0">
              <span className="font-body text-sm font-semibold text-[#2B1B0C]">{opt.title}</span>
              <span className="font-body text-[11px] text-[#8A7A63]">{opt.sub}</span>
            </span>
            {opt.badge && <span className="font-body text-sm font-semibold text-[#2B1B0C]">{opt.badge}</span>}
          </label>
          );
        })}
      </div>
      {isCod && (
        <p className="font-body text-[11px] text-[#8A7A63] -mt-1">
          Nothing to pay now — keep {hasResolvedPincodeRate ? formatCurrency(total) : 'the order total'} ready for the delivery partner.
        </p>
      )}
      {subtotal > 0 && subtotal <= FREE_SHIPPING_ABOVE && (
        <p className="rounded-lg bg-[#9C5A26]/10 px-3 py-2 font-body text-xs font-semibold text-[#2B1B0C] text-center">
          Add items worth {formatCurrency(FREE_SHIPPING_ABOVE + 1 - subtotal)} more to get FREE delivery
        </p>
      )}
      {hasResolvedPincodeRate && gstAmount > 0 && (
        <p className="font-body text-[11px] text-[#8A7A63] text-right -mt-1">
          Inclusive of GST: {formatCurrency(gstAmount)} (Taxable {formatCurrency(taxableValue)} + GST {formatCurrency(gstAmount)})
        </p>
      )}

          <button
            type="submit"
            disabled={submitting || rzpLoading || items.length === 0}
            className="mt-4 bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Processing...'
              : isCod
                ? 'Place Order (Cash on Delivery)'
                : hasResolvedPincodeRate
                  ? `Pay ${formatCurrency(total)}`
                  : 'Pay Now'}
          </button>
          {!isCod && (
            <p className="flex items-center justify-center gap-1.5 font-body text-[10px] text-[#8A7A63] mt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#9C5A26]" />
              Secured by Razorpay
            </p>
          )}
          <p className="font-body text-[11px] text-[#8A7A63] text-center leading-relaxed">
            All payments are subject to our{' '}
            <a href="/terms#payments" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#9C5A26] underline">
              Terms &amp; Conditions
            </a>
            . Please read them carefully before paying.
          </p>
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

      {(
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-6 md:gap-8 items-start">
          <div className="flex flex-col gap-8">
            <div className="bg-brand-paper border border-[#2B1B0C] rounded-2xl p-5 sm:p-6">
              <StepLabel n={1} title="Your Details" />

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
                        autoComplete="tel-national"
                        type="tel"
                        inputMode="numeric"
                        placeholder="10-digit mobile number *"
                        value={form.customerPhone}
                        onChange={(e) => update('customerPhone', normalizePhone(e.target.value))}
                        className={inputClass}
                      />
                      {addressPrefilled && (
                        <p className="-mt-1 font-body text-xs font-semibold text-brand-success">
                          ✓ Welcome back — we filled your last used address. Edit anything below if needed.
                        </p>
                      )}
                      <input
                        required
                        placeholder="Your name *"
                        value={form.customerName}
                        onChange={(e) => update('customerName', e.target.value)}
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
                          <p className="text-xs text-brand-success mt-1.5 font-body font-semibold">
                            ✓ Deliverable to this address{deliveryEstimate ? ` · Estimated delivery ${deliveryEstimate}` : ''}
                          </p>
                        )}
                        {/* Never show a shipping number before it's actually quoted for THIS
                            pincode — the cart-preview figure is an origin-to-origin guess and
                            showing it here reads as a real price. Only liveShipping.data (a
                            resolved quote for the exact digits in form.pincode) counts as real. */}
                        <p className="text-[10px] text-[#8A7A63] mt-1.5 font-body">
                          {subtotal > FREE_SHIPPING_ABOVE
                            ? `Orders above ${formatCurrency(FREE_SHIPPING_ABOVE)} ship free.`
                            : hasResolvedPincodeRate
                            ? `Delivery charges are added for orders of ${formatCurrency(FREE_SHIPPING_ABOVE)} or below (${formatCurrency(shippingFeeOriginal)} for this order).`
                            : `Add item worth ${formatCurrency(Math.max(FREE_SHIPPING_ABOVE + 1 - subtotal, 0))} more and claim free delivery.`}
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
      {codWarningOpen && (
        <CodWarningModal
          savings={prepaidSavings}
          onlineTotal={prepaidOptionTotal}
          codTotal={codOptionTotal}
          onPayOnline={() => {
            setPaymentMethod('PREPAID');
            setCodWarningOpen(false);
          }}
          onContinueCod={() => void submit(true)}
          onClose={() => setCodWarningOpen(false)}
        />
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
