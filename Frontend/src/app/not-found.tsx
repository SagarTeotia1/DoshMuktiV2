import { Suspense } from 'react';
import Link from 'next/link';
import { Compass, Home, Sparkles } from 'lucide-react';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

// Root-level fallback — only hit for URLs that don't resolve into the (storefront)
// route group at all. That group has its own not-found.tsx (same design) which picks
// up every in-app 404 (bad slugs, etc.) and already gets Navbar/Footer from its layout;
// this one has to bring them in manually since the root layout doesn't include chrome.
export default function NotFound() {
  return (
    <div className="app-shell min-h-screen flex flex-col">
      <AnnouncementBar />
      <Suspense>
        <Navbar />
      </Suspense>
      <main className="flex-1 relative z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 sm:py-32 flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="flex items-center gap-2 sm:gap-2.5 mb-6" aria-hidden="true">
              <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#F6E4C2] border-2 border-[#2B1B0C]" />
              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#EADFC8] border-2 border-[#2B1B0C] -translate-y-1" />
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#F6E4C2] border-2 border-[#2B1B0C]" />
              <span className="w-3 h-8 sm:h-9 border-t-2 border-dashed border-[#8A7A63] rotate-[20deg] mx-1" />
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#EADFC8] border-2 border-[#2B1B0C] translate-y-2 rotate-6" />
              <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#F6E4C2] border-2 border-[#2B1B0C] translate-y-4" />
            </div>

            <p className="font-heading font-black text-[7rem] sm:text-[9rem] leading-none tracking-tighter text-[#2B1B0C]">
              40<span className="inline-block -rotate-6 text-[#9C5A26]">4</span>
            </p>
            <span className="sticker brutal-border absolute -top-2 -right-4 sm:right-0 flex items-center gap-1 bg-[#B23A2E] text-white pl-1.5 pr-2.5 py-1 text-[10px] font-bold font-body rounded-md shadow-[3px_3px_0_0_#2B1B0C] whitespace-nowrap">
              <Sparkles className="w-2.5 h-2.5" />
              Thread Snapped
            </span>
          </div>

          <h1 className="font-heading font-black tracking-tight leading-[1.1] text-2xl sm:text-3xl text-[#2B1B0C] mb-3">
            This Page Wandered Off Its Path
          </h1>
          <p className="font-body text-sm text-[#8A7A63] mb-9 max-w-sm">
            The link you followed doesn&apos;t lead anywhere — maybe the product moved on, or the address was mistyped.
            Let&apos;s get you back on course.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link
              href="/shop"
              className="neo-card brutal-border inline-flex items-center justify-center gap-2 bg-[#2B1B0C] text-white rounded-full px-8 py-3.5 font-body font-bold uppercase tracking-widest text-xs shadow-neo-sm hover:bg-[#9C5A26] transition-colors duration-200"
            >
              <Compass className="w-4 h-4" />
              Back to Shop
            </Link>
            <Link
              href="/"
              className="neo-card brutal-border inline-flex items-center justify-center gap-2 bg-[#FCEFE0] text-[#2B1B0C] rounded-full px-8 py-3.5 font-body font-bold uppercase tracking-widest text-xs shadow-neo-sm hover:bg-[#F6E4C2] transition-colors duration-200"
            >
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
