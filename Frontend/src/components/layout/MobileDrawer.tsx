'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { Package, LogOut, LogIn, X, ChevronRight, UserRound } from 'lucide-react';
import { api } from '@/lib/api-client';
import { DrawerShopBy, DrawerSection, DRAWER_HAIRLINE } from '@/components/layout/DrawerShopBy';
import { ShopCta } from '@/components/storefront/ShopCta';
import logo from '@/assets/Logo.png';

interface Category {
  id: string;
  label: string;
  stripLabel?: string | null;
  image: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  userName: string | null;
  onLogout: () => void;
}

const HAIRLINE = DRAWER_HAIRLINE;

/** Left slide-in menu for mobile: account, orders, categories, Mulank, Rashi, purpose. */
export function MobileDrawer({ open, onClose, isAuthenticated, userName, onLogout }: Props) {
  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Portal target only exists client-side; the header's backdrop-blur would also become the
  // containing block for this fixed overlay if it rendered inside the header.
  useEffect(() => setMounted(true), []);

  // Categories are admin-managed, so load them once, the first time the drawer opens.
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    api
      .get<Category[]>('/api/products/category-thumbs')
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [open, loaded]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const name = userName?.trim();

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] transition-[visibility] md:hidden ${open ? '' : 'pointer-events-none invisible delay-300'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`absolute inset-0 bg-[#2B1B0C]/55 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-[#F6E4C2] shadow-[6px_0_24px_rgba(43,27,12,0.3)] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-3 ${HAIRLINE}`}>
          <Image src={logo} alt="Doshmukti" className="h-9 w-auto" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="-mr-2 rounded-full p-2 text-[#2B1B0C] hover:bg-[#EBD6AD]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5">
          {/* Account */}
          <div className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#9C5A26]/15 text-[#9C5A26]"
              aria-hidden
            >
              <UserRound className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-lg font-bold leading-tight text-[#2B1B0C]">
                {isAuthenticated ? (name ?? 'My account') : 'Welcome'}
              </p>
              <Link
                href={isAuthenticated ? '/profile' : '/login'}
                onClick={onClose}
                className="font-body text-xs font-semibold text-[#9C5A26] hover:underline"
              >
                {isAuthenticated ? 'View profile' : 'Log in or sign up'}
              </Link>
            </div>
          </div>

          {/* Primary action */}
          <ShopCta onClick={onClose} className="mt-5 w-full" />

          {/* Orders */}
          <Link href="/orders" onClick={onClose} className={`mt-4 flex items-center gap-3 border-y py-3.5 ${HAIRLINE}`}>
            <Package className="h-[18px] w-[18px] text-[#9C5A26]" strokeWidth={1.75} />
            <span className="flex-1 font-body text-sm font-semibold text-[#2B1B0C]">My orders</span>
            <ChevronRight className="h-4 w-4 text-[#2B1B0C]/40" />
          </Link>

          {/* Categories */}
          <DrawerSection title="Categories">
            {categories.length === 0 ? (
              <p className="font-body text-xs text-[#2B1B0C]/50">{loaded ? 'No categories yet.' : 'Loading...'}</p>
            ) : (
              <ul className="grid grid-cols-3 gap-x-3 gap-y-4">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/shop?category=${encodeURIComponent(c.id)}`}
                      onClick={onClose}
                      className="group flex flex-col gap-2"
                    >
                      <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-[#E6D3AE] ring-1 ring-[#2B1B0C]/10">
                        {c.image ? (
                          <Image
                            src={c.image}
                            alt=""
                            fill
                            sizes="30vw"
                            className="object-cover transition-transform duration-300 group-active:scale-105"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-heading text-2xl font-bold text-[#9C5A26]">
                            {c.label[0]}
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 text-center font-body text-xs font-semibold leading-tight text-[#2B1B0C]">
                        {c.stripLabel || c.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DrawerSection>

          <DrawerShopBy onNavigate={onClose} />
        </div>

        {/* Footer action */}
        <div className={`border-t bg-[#F6E4C2] px-5 py-3 ${HAIRLINE}`}>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2B1B0C]/30 py-3 font-body text-sm font-semibold text-[#2B1B0C] active:bg-[#EBD6AD]"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2B1B0C] py-3 font-body text-sm font-semibold text-[#F6E4C2] active:bg-[#9C5A26]"
            >
              <LogIn className="h-4 w-4" />
              Log in or sign up
            </Link>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
