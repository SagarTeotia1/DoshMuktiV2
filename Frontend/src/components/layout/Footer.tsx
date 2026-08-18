'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Instagram, Youtube } from 'lucide-react';
import logo from '@/assets/Logo.png';
import { MandalaMotif } from '@/components/motion/MandalaMotif';

const COLS = [
  {
    heading: 'Shop',
    links: [
      { label: 'All Products', href: '/shop' },
      { label: 'Love & Relationships', href: '/shop?purpose=love' },
      { label: 'Wealth & Prosperity', href: '/shop?purpose=wealth' },
      { label: 'Health & Vitality', href: '/shop?purpose=health' },
      { label: 'Success & Career', href: '/shop?purpose=success' },
      { label: 'Protection & Safety', href: '/shop?purpose=protection' },
      { label: 'Clarity & Peace', href: '/shop?purpose=clarity' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'Track Order', href: '/track' },
      { label: 'Returns & Exchanges', href: '/returns' },
      { label: 'Shipping Policy', href: '/shipping' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About Doshhmukti', href: '/about' },
      { label: 'Our Story', href: '/story' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
];

function NewsletterForm() {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Phase 2: integrate with MSG91 list
    setStatus('success');
  }

  return (
    <form onSubmit={handleSubmit}>
      {status === 'success' ? (
        <p className="text-[#9C5A26] font-body text-sm font-bold">
          ✓ You're on the list. Expect good energy.
        </p>
      ) : (
        <div className="flex border border-[#3A3A3A] rounded-full overflow-hidden">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Your WhatsApp number"
            required
            className="flex-1 bg-[#1A1A1A] border-0 px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-[#E6D3AE] focus:outline-none focus:ring-0 placeholder:text-[#5A5A5A] font-body"
          />
          <button
            type="submit"
            className="shadow-neo-gold-md bg-[#9C5A26] text-[#2B1B0C] px-4 sm:px-6 md:px-8 py-3 sm:py-4 font-body font-bold uppercase tracking-widest text-[10px] sm:text-xs hover:bg-[#C9863F] transition-colors flex-shrink-0"
          >
            Subscribe
          </button>
        </div>
      )}
      <p className="text-[10px] text-[#5A5A5A] mt-2 font-body">
        Exclusive deals + spiritual guidance, directly on WhatsApp.
      </p>
    </form>
  );
}

export function Footer() {
  return (
    <footer
      className="bg-[#2B1B0C] text-[#E6D3AE] relative"
      style={{
        backgroundImage:
          'radial-gradient(circle at 85% 20%, rgba(156,90,38,0.12), transparent 35%), radial-gradient(circle at 12% 75%, rgba(156,90,38,0.18), transparent 30%)',
      }}
    >
      <MandalaMotif className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 text-[#C9863F]/[0.05]" />

      {/* Newsletter */}
      <div className="border-b border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-14 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-2">
                Stay Connected
              </p>
              <h3 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#E6D3AE]">
                Good Energy,<br />Delivered Weekly
              </h3>
            </div>
            <NewsletterForm />
          </div>
        </div>
      </div>

      {/* Links grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
          {/* Brand column */}
          <div>
            <div className="flex items-center mb-4">
              <Image src={logo} alt="Doshhmukti" className="h-10 w-auto" />
            </div>
            <p className="font-body text-xs text-[#8A7A63] leading-relaxed mb-5 max-w-[180px]">
              Authentic spiritual products curated with intention, for every seeker.
            </p>
            {/* Social */}
            <div className="flex gap-2">
              {[
                { icon: Instagram, href: 'https://instagram.com/doshhmukti', label: 'Instagram' },
                { icon: Youtube, href: 'https://youtube.com/@doshhmukti', label: 'YouTube' },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-full border border-[#3A3A3A] flex items-center justify-center hover:border-[#9C5A26] hover:text-[#9C5A26] transition-colors text-[#8A7A63]"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {COLS.map((col) => (
            <div key={col.heading}>
              <h4 className="font-body text-[10px] font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-4">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-body text-xs text-[#8A7A63] hover:text-[#9C5A26] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#2A2A2A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="font-body text-[10px] text-[#5A5A5A]">
            © {new Date().getFullYear()} Doshhmukti. All rights reserved.
          </p>
          <p className="font-body text-[10px] text-[#5A5A5A]">
            Made with intention in India 🇮🇳
          </p>
        </div>
      </div>
    </footer>
  );
}
