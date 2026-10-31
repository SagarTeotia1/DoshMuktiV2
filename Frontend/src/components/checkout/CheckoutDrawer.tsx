'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X, Minus, Plus, ChevronDown, Ticket, Copy, Check, Sparkles, ArrowRight } from 'lucide-react';
import { useCheckout, normalizePhone } from '@/hooks/use-checkout';
import type { CartScope } from '@/hooks/use-cart';
import { CodWarningModal } from '@/components/checkout/CodWarningModal';
import { formatCurrency } from '@/lib/formatters';
import { MAX_COD_ORDER_TOTAL } from '@/lib/constants';
import type { SuggestedCoupon } from '@/types/api.types';

const field =
  'w-full bg-white border border-[#2B1B0C]/20 rounded-xl px-4 py-3 min-h-[54px] text-base sm:text-sm focus:ring-2 focus:ring-[#9C5A26] focus:border-[#9C5A26] focus:outline-none font-body placeholder:text-[#8A7A63] transition-colors';

function couponDescription(c: SuggestedCoupon): string {
  const value = c.type === 'FLAT' ? formatCurrency(c.value) : `${c.value}%`;
  const cap = c.maxDiscount ? `, up to ${formatCurrency(c.maxDiscount)}` : '';
  const minOrder = c.minOrder ? ` on orders above ${formatCurrency(c.minOrder)}` : '';
  return `${value} off${cap}${minOrder}`;
}

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-body text-xs font-bold uppercase tracking-[0.14em] text-[#2B1B0C]">{children}</h3>
      {right}
    </div>
  );
}

// Buy Now checkout as a right-hand drawer (bottom-anchored full sheet on phones): items,
// coupons/offers, details + address, bill, and the pay buttons — all without leaving the
// product page and without any login. Cart checkout keeps using /checkout.
export function CheckoutDrawer({ open, onClose, scope }: { open: boolean; onClose: () => void; scope: CartScope }) {
  const c = useCheckout(scope, { onNavigate: onClose });
  const emptyCart = !!c.cart && c.items.length === 0;
  const formRef = useRef<HTMLFormElement>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const resolved = c.hasResolvedPincodeRate;
  const payOnlineAmount = resolved
    ? c.prepaidOptionTotal
    : Math.max(c.subtotal - c.autoAppliedDiscount - c.couponDiscount, 0);
  const isCod = c.isCod;
  const shownAmount = isCod ? c.codOptionTotal : payOnlineAmount;
  // Under the free-shipping threshold the delivery fee depends on the pincode, so any price
  // shown before it resolves would be wrong — show a prompt instead of an amount.
  const pincodeComplete = /^\d{6}$/.test(c.form.pincode);
  const pincodeHint = pincodeComplete ? 'Checking…' : 'Enter pincode';
  const busy = c.submitting || c.rzpLoading || c.items.length === 0;

  function validOrFocus(): boolean {
    return formRef.current?.reportValidity() ?? false;
  }

  function payNow() {
    if (!validOrFocus()) return;
    c.setPaymentMethod('PREPAID');
    void c.submit(false, 'PREPAID');
  }

  // Tapping the small COD chip only switches the footer into COD mode (bigger COD action,
  // online-savings strip). The "pay online & save" warning modal appears when they confirm.
  function chooseCod() {
    c.setPaymentMethod('COD');
  }

  function placeCod() {
    if (!validOrFocus()) return;
    c.setCodWarningOpen(true);
  }

  return (
    <div
      className={`fixed inset-0 z-[100] ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        className={`absolute bottom-0 right-0 top-0 flex w-[88%] max-w-[460px] flex-col overflow-hidden bg-[#FFFDF8] shadow-2xl transition-transform duration-300 ease-out sm:w-full ${
          open ? 'translate-x-0' : 'translate-x-[110%]'
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between bg-[#2B1B0C] px-5 py-5 text-[#E6D3AE]">
          <div>
            <p className="font-heading text-xl font-bold leading-tight">Your Cart</p>
            <p className="mt-0.5 font-body text-sm opacity-80">
              {c.items.length} item{c.items.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          {emptyCart && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="font-heading text-lg font-bold text-[#2B1B0C]">Your cart is empty</p>
              <p className="font-body text-sm text-[#6B5539]">Add something you like and it will show up here.</p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[#2B1B0C] px-6 py-3 font-body text-sm font-bold text-white hover:bg-[#9C5A26] transition-colors"
              >
                Continue shopping
              </button>
            </div>
          )}
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              payNow();
            }}
            className={`flex flex-col gap-8 ${emptyCart ? 'hidden' : ''}`}
          >
            {/* Items */}
            <div className="flex flex-col gap-3">
              {c.items.map((item) => (
                <div key={item.variantId} className="flex gap-4 rounded-2xl border border-[#2B1B0C]/10 bg-white p-4 shadow-sm">
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={88}
                      height={88}
                      className="h-[88px] w-[88px] flex-shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[15px] font-semibold leading-snug text-[#2B1B0C] line-clamp-2">{item.productName}</p>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-body text-lg font-bold text-[#2B1B0C]">{formatCurrency(item.price)}</span>
                      {item.compareAtPrice && item.compareAtPrice > item.price && (
                        <span className="font-body text-xs text-[#8A7A63] line-through">
                          {formatCurrency(item.compareAtPrice)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#2B1B0C]/20">
                      <button
                        type="button"
                        onClick={() => c.updateQuantity(item.variantId, item.quantity - 1)}
                        disabled={c.isUpdating}
                        aria-label="Decrease quantity"
                        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F6E4C2] disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-5 text-center font-body text-sm font-semibold tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => c.updateQuantity(item.variantId, item.quantity + 1)}
                        disabled={c.isUpdating || item.quantity >= item.maxStock}
                        aria-label="Increase quantity"
                        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#F6E4C2] disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(c.cart?.freeItems ?? []).map((item) => (
                <p key={item.variantId} className="font-body text-xs font-semibold text-[#9C5A26]">
                  🎁 {item.productName}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''} — FREE
                </p>
              ))}
            </div>

            {/* Coupons / offers */}
            <section>
              <SectionLabel
                right={
                  c.suggestedCoupons.length > 0 ? (
                    <span className="font-body text-xs font-bold text-[#9C5A26]">See all ({c.suggestedCoupons.length})</span>
                  ) : null
                }
              >
                Apply coupon
              </SectionLabel>
              {c.appliedCoupon ? (
                <div className="flex items-center justify-between rounded-xl border border-[#1E7B4A]/40 bg-[#1E7B4A]/10 px-3 py-2.5">
                  <span className="font-body text-sm text-[#2B1B0C]">
                    <span className="font-bold">{c.appliedCoupon.code}</span> applied · you save{' '}
                    {formatCurrency(c.couponDiscount)}
                  </span>
                  <button
                    type="button"
                    onClick={c.handleRemoveCoupon}
                    className="font-body text-xs font-bold uppercase text-[#8A7A63] hover:text-[#B23A2E]"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={c.couponInput}
                      onChange={(e) => {
                        c.setCouponInput(e.target.value.toUpperCase());
                        c.setCouponError(null);
                      }}
                      placeholder="Enter coupon code"
                      className={`${field} uppercase`}
                    />
                    <button
                      type="button"
                      onClick={() => c.handleApplyCoupon()}
                      disabled={c.couponLoading || !c.couponInput.trim()}
                      className="flex-shrink-0 rounded-xl bg-[#2B1B0C] px-5 font-body text-sm font-bold text-white disabled:opacity-40 min-h-[54px]"
                    >
                      {c.couponLoading ? '...' : 'Apply'}
                    </button>
                  </div>
                  {c.couponError && (
                    <p className="mt-1.5 font-body text-xs font-semibold text-[#B23A2E]">{c.couponError}</p>
                  )}
                  {c.suggestedCoupons.length > 0 && (
                    <div className="mt-4 -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 hide-scrollbar">
                      {c.suggestedCoupons.map((s) => (
                        <div
                          key={s.id}
                          className="w-[88%] flex-shrink-0 snap-start rounded-2xl border border-[#2B1B0C]/10 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded border border-dashed border-[#2B1B0C]/50 px-2 py-0.5 font-heading text-xs font-black tracking-wide text-[#2B1B0C]">
                              <Ticket className="w-3 h-3" />
                              {s.code}
                              <button
                                type="button"
                                onClick={() => c.handleCopyCode(s.code)}
                                aria-label="Copy code"
                                className="text-[#8A7A63]"
                              >
                                {c.copiedCode === s.code ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </span>
                            <button
                              type="button"
                              onClick={() => c.handleApplyCoupon(s.code)}
                              disabled={c.couponLoading}
                              className="font-body text-sm font-bold text-[#9C5A26] disabled:opacity-50"
                            >
                              Apply
                            </button>
                          </div>
                          <p className="mt-2.5 font-body text-sm text-[#6B5539] leading-snug">{couponDescription(s)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            <hr className="border-dashed border-[#2B1B0C]/20" />

            {/* Details — no login; a known number pre-fills the last address */}
            <section className="flex flex-col gap-3">
              <SectionLabel>Your details</SectionLabel>
              <div className="flex gap-2">
                <span className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-[#2B1B0C]/25 bg-white px-3 font-body text-base sm:text-sm text-[#2B1B0C]">
                  🇮🇳 +91
                </span>
                <input
                  required
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  pattern="[6-9][0-9]{9}"
                  title="Enter a valid 10-digit mobile number"
                  placeholder="10-digit mobile number *"
                  value={c.form.customerPhone}
                  onChange={(e) => c.update('customerPhone', normalizePhone(e.target.value))}
                  className={field}
                />
              </div>
              {c.addressPrefilled && (
                <p className="-mt-1 font-body text-xs font-semibold text-[#1E7B4A]">
                  ✓ Welcome back — we filled your last used address.
                </p>
              )}
              <input
                required
                placeholder="Your name *"
                autoComplete="name"
                value={c.form.customerName}
                onChange={(e) => c.update('customerName', e.target.value)}
                className={field}
              />
              {emailOpen || c.form.customerEmail ? (
                <input
                  type="email"
                  placeholder="Email (optional)"
                  autoComplete="email"
                  value={c.form.customerEmail}
                  onChange={(e) => c.update('customerEmail', e.target.value)}
                  className={field}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEmailOpen(true)}
                  className="self-start font-body text-xs font-bold text-[#9C5A26]"
                >
                  + Add email for order updates (optional)
                </button>
              )}
            </section>

            <section className="flex flex-col gap-3">
              <SectionLabel>Delivery address</SectionLabel>
              {/* Pincode first: it decides serviceability and the delivery charge shown below. */}
              <div>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="Pincode *"
                  value={c.form.pincode}
                  onChange={(e) => c.update('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={field}
                />
                {c.isChecking && <p className="mt-1.5 font-body text-xs text-[#8A7A63]">Checking serviceability...</p>}
                {c.serviceable === false && (
                  <p className="mt-1.5 font-body text-xs font-semibold text-[#B23A2E]">Not serviceable at this pincode</p>
                )}
                {c.serviceable === true && (
                  <p className="mt-1.5 font-body text-xs font-semibold text-[#1E7B4A]">
                    ✓ Deliverable{c.deliveryEstimate ? ` · Estimated delivery ${c.deliveryEstimate}` : ''}
                  </p>
                )}
              </div>
              <input
                required
                placeholder="House no., Street, Area *"
                autoComplete="address-line1"
                value={c.form.line1}
                onChange={(e) => c.update('line1', e.target.value)}
                className={field}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  placeholder="City *"
                  autoComplete="address-level2"
                  value={c.form.city}
                  onChange={(e) => c.update('city', e.target.value)}
                  className={field}
                />
                <input
                  required
                  placeholder="State *"
                  autoComplete="address-level1"
                  value={c.form.state}
                  onChange={(e) => c.update('state', e.target.value)}
                  className={field}
                />
              </div>
            </section>
          </form>
        </div>

        {/* Sticky footer: bill + pay */}
        <footer className="border-t border-[#2B1B0C]/15 bg-white shadow-[0_-6px_16px_rgba(43,27,12,0.08)] pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => setBillOpen((v) => !v)}
            className="flex w-full items-center justify-between border-b border-[#2B1B0C]/10 px-5 py-3 font-body text-sm"
            aria-expanded={billOpen}
          >
            <span className="flex items-center gap-1 font-bold text-[#2B1B0C]">
              Bill Details <ChevronDown className={`w-3.5 h-3.5 transition-transform ${billOpen ? 'rotate-180' : ''}`} />
            </span>
            <span className="font-bold text-[#9C5A26]">{billOpen ? 'Hide breakdown' : 'View breakdown'}</span>
          </button>
          {billOpen && (
            <div className="flex flex-col gap-1.5 px-4 py-3 font-body text-sm text-[#6B5539]">
              <Row label="Subtotal" value={formatCurrency(c.subtotal)} />
              {c.savings > 0 && <Row label="You saved" value={formatCurrency(c.savings)} accent />}
              <Row
                label="Shipping & Packaging"
                value={!resolved ? 'Enter pincode' : c.shippingFee === 0 ? 'FREE' : formatCurrency(c.shippingFee)}
              />
              {c.autoAppliedDiscount > 0 && <Row label="Offer discount" value={`−${formatCurrency(c.autoAppliedDiscount)}`} accent />}
              {c.couponDiscount > 0 && <Row label="Coupon discount" value={`−${formatCurrency(c.couponDiscount)}`} accent />}
              {/* COD charge belongs to COD only — never listed on a prepaid bill. */}
              {isCod && <Row label="COD charges" value={formatCurrency(c.codFee)} />}
              <div className="mt-1 flex justify-between border-t border-[#2B1B0C]/10 pt-2 font-bold text-[#2B1B0C]">
                <span>{isCod ? 'Pay on delivery' : 'Total'}</span>
                <span>{resolved ? formatCurrency(shownAmount) : pincodeHint}</span>
              </div>
              {resolved && c.gstAmount > 0 && (
                <p className="text-[11px] text-[#8A7A63]">Inclusive of GST: {formatCurrency(c.gstAmount)}</p>
              )}
            </div>
          )}

          {/* COD picked → nudge straight back to paying online, one tap, no extra screen */}
          {isCod && resolved && (
            <div className="mx-3 mt-3 overflow-hidden rounded-2xl border border-[#9C5A26]/40 bg-gradient-to-r from-[#F6E4C2] to-[#FFFDF8] shadow-sm min-[340px]:mx-4">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6B3D19] to-[#C9863F] text-[#FFFDF8]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[13px] font-extrabold leading-tight text-[#6B3D19]">
                    Pay online &amp; save {formatCurrency(c.prepaidSavings)}
                  </p>
                  <p className="mt-0.5 font-body text-[11px] leading-tight text-[#2B1B0C]/70">
                    <span className="line-through opacity-70">{formatCurrency(c.codOptionTotal)}</span>{' '}
                    <span className="font-bold text-[#2B1B0C]">{formatCurrency(payOnlineAmount)}</span> · no COD charge
                  </p>
                </div>
                <button
                  type="button"
                  onClick={payNow}
                  disabled={busy}
                  className="flex h-9 flex-shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#6B3D19] via-[#9C5A26] to-[#C9863F] px-3 font-body text-xs font-bold text-[#FFFDF8] shadow-[0_3px_10px_rgba(156,90,38,0.45)] transition-all hover:brightness-110 active:scale-[0.96] disabled:opacity-50"
                >
                  Pay Now <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-1 min-[340px]:px-5">
            <div className="min-w-0 flex-shrink-0">
              <p className="font-body text-[11px] leading-tight text-[#8A7A63]">
                {isCod ? 'Pay on delivery' : 'Amount to Pay'}
              </p>
              {resolved ? (
                <p className="font-heading text-2xl font-extrabold leading-tight text-[#2B1B0C]">
                  {formatCurrency(shownAmount)}
                </p>
              ) : (
                <p className="font-heading text-base font-extrabold leading-tight text-[#9C5A26]">{pincodeHint}</p>
              )}
              {!isCod && resolved && (
                <p className="font-body text-[10px] font-bold leading-tight text-[#1E7B4A]">
                  Prepaid saves {formatCurrency(c.prepaidSavings)}
                </p>
              )}
            </div>

            {isCod ? (
              <>
                {/* COD mode: COD is the primary action, prepaid shrinks to a switch-back chip */}
                <button
                  type="button"
                  onClick={() => c.setPaymentMethod('PREPAID')}
                  className="flex h-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl border border-[#1E7B4A]/50 bg-white px-3 text-center font-body transition-colors hover:bg-[#1E7B4A]/10 active:scale-[0.97]"
                >
                  <span className="text-[11px] font-bold leading-none text-[#1E7B4A]">Online</span>
                  <span className="mt-1 text-xs font-semibold leading-none text-[#2B1B0C]">{resolved ? formatCurrency(payOnlineAmount) : '—'}</span>
                </button>
                <button
                  type="button"
                  onClick={placeCod}
                  disabled={busy}
                  className="flex h-14 min-w-0 flex-1 items-center justify-center rounded-2xl bg-[#2B1B0C] px-3 font-body text-base font-bold leading-none text-white shadow-[0_4px_14px_rgba(43,27,12,0.35)] transition-colors hover:bg-[#9C5A26] active:scale-[0.98] disabled:opacity-50"
                >
                  {c.submitting ? 'Processing...' : <span className="whitespace-nowrap">Place COD Order</span>}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={chooseCod}
                  disabled={busy || c.codUnavailable || !resolved}
                  title={c.codUnavailable ? `COD only up to ${formatCurrency(MAX_COD_ORDER_TOTAL)}` : undefined}
                  className="flex h-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl border border-[#2B1B0C]/70 bg-white px-3 text-center font-body transition-colors hover:bg-[#F6E4C2]/60 active:scale-[0.97] disabled:opacity-40"
                >
                  <span className="text-[11px] font-bold leading-none text-[#2B1B0C]">COD</span>
                  <span className="mt-1 text-xs font-semibold leading-none text-[#6B5539]">
                    {resolved ? formatCurrency(c.codOptionTotal) : '—'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={payNow}
                  disabled={busy}
                  className="flex h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2B1B0C] px-3 font-body text-white shadow-[0_4px_14px_rgba(43,27,12,0.35)] transition-colors hover:bg-[#9C5A26] active:scale-[0.98] disabled:opacity-50"
                >
                  {c.submitting ? (
                    <span className="text-sm font-bold">Processing...</span>
                  ) : (
                    <>
                      <span className="whitespace-nowrap text-base font-bold leading-none">Pay Now</span>
                      <span className="hidden min-[300px]:inline rounded-md bg-white/15 px-1.5 py-1 text-[9px] font-bold leading-none tracking-wide text-[#E6D3AE]">
                        UPI
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
          {c.codUnavailable && !isCod && (
            <p className="px-4 pb-1 text-center font-body text-[10px] font-semibold text-[#8A7A63]">
              COD is available only up to {formatCurrency(MAX_COD_ORDER_TOTAL)} — pay online for this order.
            </p>
          )}
          <div className="pb-1.5" />
        </footer>
      </aside>

      {c.codWarningOpen && (
        <CodWarningModal
          savings={c.prepaidSavings}
          onlineTotal={c.prepaidOptionTotal}
          codTotal={c.codOptionTotal}
          onPayOnline={() => {
            c.setCodWarningOpen(false);
            payNow();
          }}
          onContinueCod={() => void c.submit(true, 'COD')}
          onClose={() => c.setCodWarningOpen(false)}
        />
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? 'font-semibold text-[#9C5A26]' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
