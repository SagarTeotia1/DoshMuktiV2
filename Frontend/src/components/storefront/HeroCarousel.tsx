'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const SLIDES = [
  {
    id: 1,
    badge: 'New Arrival',
    eyebrow: 'Love & Relationships',
    title: ['Attract What', 'You Seek'],
    subtitle: 'Sacred rings and bracelets charged with intention — for love, abundance, and inner harmony.',
    cta: 'Shop Love Collection',
    href: '/shop?purpose=love',
    image: 'https://images.unsplash.com/photo-1768569446356-e1c0013cc733?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400',
    imageAlt: 'Rose Quartz Love Bracelet',
  },
  {
    id: 2,
    badge: 'Bestseller',
    eyebrow: 'Wealth & Prosperity',
    title: ['Wealth Flows', 'To The Ready'],
    subtitle: 'Curated crystals and yantras to invite abundance and financial clarity into your life.',
    cta: 'Shop Wealth Collection',
    href: '/shop?purpose=wealth',
    image: 'https://images.unsplash.com/photo-1653190262923-fa971c552377?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400',
    imageAlt: 'Yellow Sapphire Pukhraj',
  },
  {
    id: 3,
    badge: 'Limited Edition',
    eyebrow: 'Protection & Safety',
    title: ['Ward Off', 'Negativity'],
    subtitle: 'Powerful protection malas and pendants — authenticated, energized, delivered with care.',
    cta: 'Shop Protection',
    href: '/shop?purpose=protection',
    image: 'https://images.unsplash.com/photo-1622993361118-b6365d859ab6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400',
    imageAlt: '5 Mukhi Rudraksha Mala',
  },
];

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => setActive((a) => (a + 1) % SLIDES.length), []);
  const prev = useCallback(() => setActive((a) => (a - 1 + SLIDES.length) % SLIDES.length), []);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(next, 5500);
    return () => clearTimeout(t);
  }, [active, paused, next]);

  const slide = SLIDES[active];
  if (!slide) return null;

  return (
    <section
      className="relative h-[58vh] sm:h-[68vh] md:h-[78vh] lg:h-[calc(100dvh-56px)] bg-[#2B1B0C] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background images — full bleed */}
      {SLIDES.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
            idx === active ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <Image
            src={s.image}
            alt={s.imageAlt}
            fill
            className={`object-cover object-center ${
              idx === active ? 'animate-ken-burns' : ''
            }`}
            sizes="100vw"
            priority={idx === 0}
          />
        </div>
      ))}

      {/* Atmospheric overlays */}
      <div className="absolute inset-0 z-20 bg-gradient-to-r from-[#2B1B0C]/92 via-[#2B1B0C]/65 to-[#2B1B0C]/25" />
      <div className="absolute inset-0 z-20 bg-gradient-to-t from-[#2B1B0C]/75 via-transparent to-[#2B1B0C]/35" />

      {/* Grain texture */}
      <div
        className="absolute inset-0 z-20 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* Gold left accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] z-30 bg-gradient-to-b from-transparent via-[#9C5A26]/70 to-transparent" />

      {/* Decorative circle */}
      <div
        className="absolute right-[10%] top-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] z-20 pointer-events-none opacity-[0.06]"
        style={{
          border: '1px solid #9C5A26',
          borderRadius: '50%',
          boxShadow: 'inset 0 0 80px rgba(156,90,38,0.3)',
        }}
      />
      <div
        className="absolute right-[10%] top-1/2 -translate-y-1/2 w-[28vw] h-[28vw] max-w-[340px] max-h-[340px] z-20 pointer-events-none opacity-[0.04]"
        style={{
          border: '1px solid #9C5A26',
          borderRadius: '50%',
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 z-30 flex items-center">
        <div className="w-full max-w-7xl mx-auto px-5 sm:px-10 md:px-14 lg:px-16">
          <div className="max-w-lg lg:max-w-2xl">
            {/* Eyebrow */}
            <div className="flex items-center gap-2.5 mb-2.5 sm:mb-4 animate-fade-in">
              <div className="h-px w-6 sm:w-10 bg-[#9C5A26]" />
              <span className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26]">
                {slide.eyebrow}
              </span>
            </div>

            {/* Badge */}
            <div className="mb-2 sm:mb-3">
              <span className="sticker inline-block px-2.5 py-0.5 rounded-full bg-[#9C5A26] text-[#2B1B0C] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider border border-[#2B1B0C]/70 shadow-[2px_2px_0_0_rgba(43,27,12,0.7)]">
                {slide.badge}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-display text-5xl md:text-7xl font-black italic tracking-tight uppercase text-white leading-[0.95] mb-3 sm:mb-5 animate-fade-in-up">
              {slide.title.map((line, i) => (
                <span key={i} className="block">
                  {i === 1 ? <span className="text-[#9C5A26]">{line}</span> : line}
                </span>
              ))}
            </h1>

            {/* Subtitle — hidden on smallest screens to reduce clutter */}
            <p className="hidden xs:block text-white/65 text-xs sm:text-sm md:text-base max-w-sm sm:max-w-md leading-relaxed mb-5 sm:mb-7 font-body animate-fade-in delay-200">
              {slide.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 animate-fade-in delay-300">
              <Link
                href={slide.href}
                className="inline-block rounded-lg bg-[#9C5A26] text-[#FBF1DF] border border-[#9C5A26] px-5 sm:px-8 py-2.5 sm:py-3.5 font-body font-bold uppercase tracking-widest text-xs active:scale-95 hover:bg-brand-paper hover:border-brand-paper hover:text-[#2B1B0C] hover:shadow-neo-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                {slide.cta}
              </Link>
              <Link
                href="/shop"
                className="text-white/55 hover:text-white/90 font-body text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-colors duration-200 flex items-center gap-1.5"
              >
                All <span className="text-[#9C5A26]">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Slide counter — top right */}
      <div className="absolute top-5 right-6 sm:top-7 sm:right-10 z-30 flex items-center gap-2.5">
        <span className="font-heading font-black text-[#9C5A26] text-base sm:text-lg leading-none tabular-nums">
          {String(active + 1).padStart(2, '0')}
        </span>
        <div className="h-px w-6 sm:w-8 bg-white/25" />
        <span className="font-heading font-bold text-white/25 text-xs sm:text-sm leading-none tabular-nums">
          {String(SLIDES.length).padStart(2, '0')}
        </span>
      </div>

      {/* Prev / Next — bottom left cluster */}
      <div className="absolute left-6 sm:left-10 md:left-14 lg:left-16 bottom-6 sm:bottom-8 z-30 flex items-center gap-2">
        <button
          onClick={prev}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/20 flex items-center justify-center hover:border-[#9C5A26] hover:bg-[#9C5A26]/10 transition-all duration-200 backdrop-blur-sm"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </button>
        <button
          onClick={next}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/20 flex items-center justify-center hover:border-[#9C5A26] hover:bg-[#9C5A26]/10 transition-all duration-200 backdrop-blur-sm"
          aria-label="Next slide"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </button>
      </div>

      {/* Dot indicators — right side vertical */}
      <div className="absolute right-5 sm:right-8 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-2.5">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setActive(idx)}
            className={`transition-all duration-400 block ${
              idx === active
                ? 'h-8 w-[3px] rounded-full bg-[#9C5A26]'
                : 'h-2.5 w-[3px] rounded-full bg-white/25 hover:bg-white/50'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
