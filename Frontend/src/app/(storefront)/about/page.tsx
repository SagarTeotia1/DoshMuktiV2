import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Gem, HandHeart, ShieldCheck, Sparkles } from 'lucide-react';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';
import { TrustBar } from '@/components/storefront/TrustBar';
import { SITE_URL } from '@/lib/constants';

const VALUES = [
  {
    icon: Gem,
    title: 'Authentic Sourcing',
    body: 'Every rudraksha, gemstone, and mala is sourced directly from verified artisans — no mass-produced imitations.',
  },
  {
    icon: Sparkles,
    title: 'Energized With Intention',
    body: 'Each piece is ritually energized before it reaches you, following traditional Vedic practice.',
  },
  {
    icon: HandHeart,
    title: 'Guided, Not Just Sold',
    body: 'Acharya Madhav is here to recommend what actually fits your chart and your goals — not just push a sale.',
  },
  {
    icon: ShieldCheck,
    title: 'Honest, No Gimmicks',
    body: 'Transparent pricing, real reviews, and a straightforward 7-day return policy. No fine print tricks.',
  },
];

const TITLE = 'About Doshhmukti — Authentic Astrology-Guided Gemstones';
const DESCRIPTION =
  'Doshhmukti sources authentic, ritually-energized gemstones and rudraksha directly from verified artisans, with Vedic-astrology guidance from Acharya Madhav for every purchase.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/about`, type: 'website' },
};

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Acharya Madhav',
  jobTitle: 'Vedic Astrologer',
  worksFor: { '@type': 'Organization', name: 'Doshhmukti' },
  description:
    'Acharya Madhav is Doshhmukti\'s in-house Vedic astrologer, recommending gemstones and remedies based on birth-chart (kundli) and numerology readings for love, wealth, health, career, and protection.',
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
      <section className="relative bg-[#2B1B0C] overflow-hidden py-16 sm:py-24">
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(156,90,38,0.22), transparent 55%)' }}
        />
        <MandalaMotif className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 text-[#C9863F]/[0.06]" />

        <Reveal className="relative max-w-3xl mx-auto px-6 text-center">
          <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-3">
            Our Story
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#E6D3AE] leading-[1.05] mb-5">
            Authentic Gemstones, Astrology-Backed Guidance
          </h1>
          <p className="font-body text-sm sm:text-base text-[#B8A98A] leading-relaxed max-w-xl mx-auto">
            Doshhmukti is an Indian spiritual ecommerce store, operated by Digital Kalakaar Videos Private Limited,
            selling authentic, ritually-energized gemstones, rudraksha malas and bracelets for love, wealth, health,
            success, protection and clarity. Every product is sourced directly from verified artisans — never a
            mass-produced imitation — and paired with Vedic astrology guidance from Acharya Madhav so you buy the
            stone that actually fits your birth chart, not just the one that&apos;s trending.
          </p>
        </Reveal>
      </section>

      <TrustBar />

      <section className="py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12">
          <Reveal className="text-center mb-10 sm:mb-14">
            <h2 className="font-display font-bold tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C]">
              What We Stand For
            </h2>
          </Reveal>

          <StaggerGroup className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <StaggerItem
                  key={v.title}
                  className="flex gap-4 rounded-xl border border-[#2B1B0C]/15 bg-white p-5 sm:p-6 shadow-neo-sm hover:shadow-neo-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  <span className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F6E4C2] border border-[#2B1B0C]/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#9C5A26]" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-[#2B1B0C] mb-1.5">{v.title}</h3>
                    <p className="font-body text-sm text-[#6B5539] leading-relaxed">{v.body}</p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      <section className="pb-14 sm:pb-20 px-4 sm:px-6 lg:px-12">
        <Reveal className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden text-center rounded-2xl border border-[#2B1B0C] bg-[#2B1B0C] px-6 py-12 sm:py-16 shadow-neo-lg">
            <MandalaMotif className="pointer-events-none absolute -top-20 -left-20 w-64 h-64 text-[#C9863F]/[0.08]" />
            <h2 className="relative font-display font-bold tracking-tight leading-tight text-2xl sm:text-3xl text-[#E6D3AE] mb-3">
              Ready To Find What You Seek?
            </h2>
            <p className="relative font-body text-sm text-[#B8A98A] leading-relaxed mb-7 max-w-md mx-auto">
              Browse the full collection, or talk to Acharya Madhav for a personalized recommendation.
            </p>
            <Link
              href="/shop"
              className="relative inline-flex items-center gap-2 rounded-full bg-[#9C5A26] text-[#E6D3AE] px-7 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#C9863F] hover:text-[#2B1B0C] transition-colors duration-200"
            >
              Shop The Collection
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
