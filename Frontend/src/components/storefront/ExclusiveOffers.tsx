'use client';

import { useState } from 'react';
import { Percent, Tag, Gift, ShoppingBag, Truck, Sparkles, Wallet, Copy, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types/api.types';

type Offer = Product['offers'][number];

// Same icon-per-reward idea as the badge row above, just a distinct icon set since these
// render at card size, not pill size.
const OFFER_ICONS: Record<Offer['reward'], LucideIcon> = {
  DISPLAY_MESSAGE: Sparkles,
  PERCENTAGE_DISCOUNT: Percent,
  FLAT_DISCOUNT: Tag,
  CASHBACK: Wallet, // filtered out before render — kept for Record exhaustiveness
  FREE_GIFT: Gift,
  BUY_X_GET_Y: ShoppingBag,
  FREE_SHIPPING: Truck,
};

// DISPLAY_MESSAGE prefers the admin-authored banner text over the internal title — same
// preference order as the existing badge row's OFFER_REWARD_FORMATTERS.
function formatOfferHeading(offer: Offer): string {
  if (offer.reward === 'DISPLAY_MESSAGE') {
    return (typeof offer.config.bannerText === 'string' && offer.config.bannerText) || offer.title;
  }
  return offer.title;
}

function minOrderClause(minOrderValue: number | null): string {
  return typeof minOrderValue === 'number' ? ` on orders above ${formatCurrency(minOrderValue)}` : '';
}

// Per-reward condition/description line. COUPON_BASED offers always carry a null
// minOrderValue (the coupon's own minOrder condition isn't in this contract yet — see
// report), so the clause below simply doesn't render for them rather than needing a
// separate branch.
const OFFER_CONDITION_FORMATTERS: Record<Offer['reward'], (offer: Offer) => string | null> = {
  DISPLAY_MESSAGE: (offer) =>
    typeof offer.minOrderValue === 'number' ? `Valid on orders above ${formatCurrency(offer.minOrderValue)}` : null,
  PERCENTAGE_DISCOUNT: (offer) => {
    if (typeof offer.config.percent !== 'number') return null;
    const maxDiscount =
      typeof offer.config.maxDiscount === 'number' ? `, up to ${formatCurrency(offer.config.maxDiscount)}` : '';
    return `${offer.config.percent}% off${maxDiscount}${minOrderClause(offer.minOrderValue)}`;
  },
  FLAT_DISCOUNT: (offer) => {
    if (typeof offer.config.amount !== 'number') return null;
    return `${formatCurrency(offer.config.amount)} off your order${minOrderClause(offer.minOrderValue)}`;
  },
  CASHBACK: () => null,
  FREE_GIFT: (offer) => `Free gift with your order${minOrderClause(offer.minOrderValue)}`,
  BUY_X_GET_Y: (offer) => {
    if (typeof offer.config.buyQuantity !== 'number' || typeof offer.config.getQuantity !== 'number') return null;
    return `Buy ${offer.config.buyQuantity}, get ${offer.config.getQuantity} free${minOrderClause(offer.minOrderValue)}`;
  },
  FREE_SHIPPING: (offer) => {
    // This reward predates the top-level minOrderValue field and carries its own
    // config.minOrderValue. The top-level field is the one actually enforced at
    // checkout, so it wins when both are present.
    const effectiveMinOrder =
      typeof offer.minOrderValue === 'number'
        ? offer.minOrderValue
        : typeof offer.config.minOrderValue === 'number'
          ? offer.config.minOrderValue
          : null;
    return `Free shipping on this order${minOrderClause(effectiveMinOrder)}`;
  },
};

function formatOfferCondition(offer: Offer): string | null {
  return (OFFER_CONDITION_FORMATTERS[offer.reward] ?? (() => null))(offer);
}

function CouponCode({ code }: { code: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(code);
      setStatus('copied');
    } catch {
      // Clipboard API can throw or be entirely absent (permissions, insecure context,
      // older browser) — the code is still visible on the card to copy by hand, but the
      // button should say so rather than silently doing nothing on click.
      setStatus('failed');
    } finally {
      setTimeout(() => setStatus('idle'), 1500);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="brutal-border flex items-center justify-between gap-2 w-full rounded-md bg-white px-3 py-1.5 text-left transition-colors hover:bg-[#F6E4C2]"
    >
      <span className="font-heading font-black text-xs tracking-wide text-[#2B1B0C]">{code}</span>
      <span className="flex items-center gap-1 font-body text-[10px] font-bold uppercase tracking-wide text-[#9C5A26]">
        {status === 'copied' ? (
          <>
            <Check className="w-3 h-3" /> Copied!
          </>
        ) : status === 'failed' ? (
          'Select to copy'
        ) : (
          <>
            <Copy className="w-3 h-3" /> Copy
          </>
        )}
      </span>
    </button>
  );
}

export function ExclusiveOffers({ offers }: { offers: Product['offers'] }) {
  // Cashback already has its own dedicated badge elsewhere on the page — showing it a
  // third time here would just be redundant/contradictory, same reasoning as the badge row.
  // DISPLAY_ONLY offers stay in the existing badge row above (their whole purpose is a
  // lightweight marketing tag) — this section is specifically for offers a customer can
  // actually redeem (COUPON_BASED, via the code) or that apply automatically at checkout
  // (AUTO_APPLIED), so showing a DISPLAY_ONLY offer here too would be redundant with the
  // badge row and misleadingly imply it does something at checkout when it doesn't.
  const shownOffers = offers.filter((o) => o.reward !== 'CASHBACK' && o.behavior !== 'DISPLAY_ONLY');
  if (shownOffers.length === 0) return null;

  return (
    <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6">
      <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-4">Exclusive Offers</h2>
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
        {shownOffers.map((offer) => {
          const Icon = OFFER_ICONS[offer.reward] ?? Gift;
          const condition = formatOfferCondition(offer);

          return (
            <div
              key={offer.id}
              className="brutal-border flex flex-col gap-2 rounded-lg bg-[#FFFDF8] p-3.5 shadow-[2px_2px_0_0_#2B1B0C]"
            >
              <div className="flex items-start gap-2.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg border border-[#2B1B0C] bg-[#F6E4C2] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#9C5A26]" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="font-heading font-bold text-xs text-[#2B1B0C] leading-tight">{formatOfferHeading(offer)}</p>
                  {condition && (
                    <p className="font-body text-[11px] text-[#8A7A63] leading-snug mt-0.5">{condition}</p>
                  )}
                </div>
              </div>

              {offer.behavior === 'COUPON_BASED' && offer.coupon && <CouponCode code={offer.coupon.code} />}
              {offer.behavior === 'AUTO_APPLIED' && (
                <span className="self-start brutal-border rounded-full bg-[#2B1B0C] px-2.5 py-1 font-body text-[10px] font-bold uppercase tracking-wide text-[#FBF1DF]">
                  Auto Applied
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
