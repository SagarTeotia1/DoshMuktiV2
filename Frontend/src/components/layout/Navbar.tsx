'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Gem, Search, ShoppingCart, Menu, X, Phone } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/shop?purpose=love', label: 'Love' },
  { href: '/shop?purpose=wealth', label: 'Wealth' },
  { href: '/shop?purpose=protection', label: 'Protection' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const { cart } = useCart();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const cartCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]!);
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
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group flex-shrink-0">
          <Gem className="w-5 h-5 sm:w-6 sm:h-6 text-[#9C5A26] group-hover:rotate-12 transition-transform duration-300" />
          <span className="font-heading text-lg sm:text-xl md:text-2xl font-black tracking-tighter text-[#2B1B0C]">Doshhmukti</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 lg:px-5 py-2 rounded-full font-body text-xs font-bold uppercase tracking-[0.12em] lg:tracking-[0.15em] border transition-all duration-200 ${
                isActive(link.href)
                  ? 'bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C] shadow-neo-md'
                  : 'border-transparent hover:border-[#2B1B0C] hover:shadow-neo-md hover:-translate-y-0.5'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <a
            href="https://wa.me/919999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex p-1.5 sm:p-2 rounded-full hover:bg-[#F6E4C2] transition-colors items-center justify-center"
            title="WhatsApp us"
          >
            <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-[#2B1B0C]" />
          </a>

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
                className={`px-4 py-3 font-body text-sm font-bold uppercase tracking-[0.12em] border-b border-[#2B1B0C]/10 transition-all duration-200 ${
                  isActive(link.href) ? 'bg-[#9C5A26] text-[#2B1B0C] border-b-[#2B1B0C]' : 'hover:bg-[#F6E4C2]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://wa.me/919999999999"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 font-body text-sm font-bold uppercase tracking-[0.12em] text-[#9C5A26] hover:bg-[#F6E4C2] transition-colors flex items-center gap-2"
              onClick={() => setMenuOpen(false)}
            >
              <Phone className="w-3.5 h-3.5" />
              WhatsApp Us
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
