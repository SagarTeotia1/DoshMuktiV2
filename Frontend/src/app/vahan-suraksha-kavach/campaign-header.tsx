'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useOrderNow } from './use-order-now';

// Deliberately not the site's normal Navbar (Home/Shop/About/Orders + search + cart) —
// this page is a single-product campaign front door, not a catalog page, so the chrome
// should read that way too. Transparent over the hero, solidifies on scroll; the product
// name label fades in once the hero's own headline has scrolled past, the way Apple's
// product-page nav reveals the product name only once you've left the hero behind.
export function CampaignHeader({ variantId, productName, price }: { variantId: string; productName: string; price: number }) {
  const [solid, setSolid] = useState(false);
  const { orderNow, isOrdering } = useOrderNow(variantId, productName, price);

  useEffect(() => {
    function onScroll() {
      setSolid(window.scrollY > 420);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        solid ? 'bg-[#FFFDF8]/90 backdrop-blur-md border-b border-[#2B1B0C]/10 shadow-[0_2px_16px_rgba(43,27,12,0.06)]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
        <Link href="/" className="font-heading font-black text-sm sm:text-base tracking-tight text-[#2B1B0C]">
          Doshhmukti
        </Link>

        <span
          className={`font-heading font-bold text-xs sm:text-sm text-[#2B1B0C] absolute left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
            solid ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Vahan Suraksha Kavach
        </span>

        <button
          onClick={() => orderNow(1)}
          disabled={isOrdering}
          className="flex-shrink-0 bg-[#2B1B0C] text-[#E6D3AE] rounded-full px-4 sm:px-5 py-2 font-body font-bold text-xs sm:text-sm hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-colors disabled:opacity-50"
        >
          {isOrdering ? 'Please wait…' : 'Buy'}
        </button>
      </div>
    </header>
  );
}
