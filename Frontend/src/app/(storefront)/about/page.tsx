import Link from 'next/link';
import { Gem, HandHeart, ShieldCheck, Sparkles } from 'lucide-react';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';

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

export const metadata = { title: 'About — Doshhmukti' };

export default function AboutPage() {
  return (
    <>
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
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#FBF1DF] leading-[1.05] mb-5">
            Spiritual Tools, Sourced Honestly
          </h1>
          <p className="font-body text-sm sm:text-base text-[#B8A98A] leading-relaxed max-w-xl mx-auto">
            Doshhmukti started with a simple frustration — most &ldquo;spiritual&rdquo; products online are
            mass-produced, unenergized, and sold with fake urgency. We built the store we wished existed: authentic
            rudraksha, gemstones, and malas, sourced with care and backed by real guidance.
          </p>
        </Reveal>
      </section>

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
                  className="flex gap-4 rounded-xl border border-[#2B1B0C]/12 bg-white p-5 sm:p-6 hover:shadow-neo-md hover:-translate-y-0.5 transition-all duration-300"
                >
                  <span className="flex-shrink-0 w-11 h-11 rounded-full bg-[#F6E4C2] flex items-center justify-center">
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

      <section className="bg-[#F6E4C2]/50 py-12 sm:py-16">
        <Reveal className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-display font-bold tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-3">
            Ready To Find What You Seek?
          </h2>
          <p className="font-body text-sm text-[#6B5539] leading-relaxed mb-6">
            Browse the full collection, or talk to Acharya Madhav for a personalized recommendation.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full bg-[#9C5A26] text-[#FBF1DF] px-7 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#2B1B0C] transition-colors duration-200"
          >
            Shop The Collection
          </Link>
        </Reveal>
      </section>
    </>
  );
}
