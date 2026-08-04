'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, ShoppingCart, Menu, X, User, LogOut } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import logo from '@/assets/Logo.png';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/orders', label: 'Orders' },
];

/** Filter keys that determine "is this nav item the active view" — sort/page are cosmetic, ignored. */
const FILTER_KEYS = ['purpose', 'category', 'q', 'featured'];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const { cart } = useCart();
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const cartCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    const [path, query] = href.split('?');
    if (pathname !== path) return false;

    if (!query) return FILTER_KEYS.every((k) => !searchParams.get(k));

    const linkParams = new URLSearchParams(query);
    return [...linkParams.entries()].every(([k, v]) => searchParams.get(k) === v);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchOpen(false);
    setSearchQuery('');
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b border-[#2B1B0C] transition-all duration-300 ${
        scrolled ? 'bg-[#FBF1DF]/96 backdrop-blur-lg shadow-neo-sm' : 'bg-[#FBF1DF]/90 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 flex items-center justify-between h-14 sm:h-16">
        <Link href="/" className="flex items-center group flex-shrink-0">
          <Image
            src={logo}
            alt="Doshhmukti"
            priority
            className="h-10 sm:h-12 md:h-14 w-auto group-hover:scale-105 transition-transform duration-300"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 lg:gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 lg:px-5 py-2 rounded-full font-body text-xs font-bold uppercase tracking-[0.12em] lg:tracking-[0.15em] border transition-all duration-200 ${
                isActive(link.href)
                  ? 'bg-[#9C5A26] text-[#FBF1DF] border-[#2B1B0C] shadow-neo-md'
                  : 'border-transparent hover:border-[#2B1B0C] hover:shadow-neo-md hover:-translate-y-0.5'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              setMenuOpen(false);
            }}
            className="p-1.5 sm:p-2 rounded-full hover:bg-[#F6E4C2] transition-colors"
            aria-label="Search"
          >
            {searchOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Search className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {isAuthenticated ? (
            <div className="hidden sm:flex items-center gap-0.5">
              <Link
                href="/profile"
                className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-full hover:bg-[#F6E4C2] transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="font-body text-xs font-semibold text-[#2B1B0C] max-w-[100px] truncate">
                  {user?.name.split(' ')[0]}
                </span>
              </Link>
              <button
                onClick={logout}
                className="p-1.5 rounded-full hover:bg-[#F6E4C2] transition-colors"
                aria-label="Log out"
              >
                <LogOut className="w-3.5 h-3.5 text-[#8A7A63]" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden sm:flex items-center p-1.5 sm:p-2 rounded-full hover:bg-[#F6E4C2] transition-colors"
              aria-label="Log in"
            >
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
          )}

          <Link href="/cart" className="relative p-1.5 sm:p-2 rounded-full hover:bg-[#F6E4C2] transition-colors" aria-label="Cart">
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-[#9C5A26] text-[#2B1B0C] border border-[#2B1B0C] rounded-full text-[9px] sm:text-[10px] font-bold flex items-center justify-center leading-none">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </Link>

          <button
            onClick={() => {
              setMenuOpen((v) => !v);
              setSearchOpen(false);
            }}
            className="md:hidden p-1.5 sm:p-2 rounded-full hover:bg-[#F6E4C2] transition-colors"
            aria-label="Menu"
          >
            {menuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-[#2B1B0C] bg-[#FBF1DF] animate-fade-in">
          <form onSubmit={handleSearch} className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-12 py-3 flex gap-2">
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for rings, crystals, malas..."
              className="flex-1 bg-white border border-[#2B1B0C] rounded-lg px-3 sm:px-4 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none font-body placeholder:text-[#8A7A63]"
            />
            <button
              type="submit"
              className="bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-4 sm:px-6 py-2.5 font-body font-bold uppercase tracking-widest text-[10px] sm:text-xs hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200"
            >
              Search
            </button>
          </form>
        </div>
      )}

      {menuOpen && (
        <div className="md:hidden border-t border-[#2B1B0C] bg-[#FBF1DF] animate-fade-in">
          <nav className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-1.5 px-4 py-3 font-body text-xs font-bold uppercase tracking-[0.12em] border-b border-[#2B1B0C]/10 transition-all duration-200 ${
                  isActive(link.href) ? 'bg-[#9C5A26] text-[#FBF1DF] border-b-[#2B1B0C]' : 'hover:bg-[#F6E4C2]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
