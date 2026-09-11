'use client';

import { MessageCircle, MoonStar, Car, Compass, ShieldAlert } from 'lucide-react';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';

// Adapted from components/storefront/AcharyaMadhavSection.tsx for this page's narrower
// single-product context — same visual language (dark bronze, kundli-chart avatar ring,
// mandala backdrop, custom-event chat handoff) but every prompt is reframed around
// vehicle safety / travel protection instead of the generic love/wealth/health trio.
function openChat(message: string) {
  window.dispatchEvent(new CustomEvent('open-acharya-chat', { detail: { message } }));
}

const ASK_ABOUT = [
  {
    icon: Car,
    label: 'Vehicle & Travel Safety',
    prompt: 'Does my chart show risk on the road right now?',
    question: 'Does my birth chart show any risk around travel or vehicle safety right now?',
  },
  {
    icon: Compass,
    label: 'Right Time to Travel',
    prompt: 'Is this a good period for long drives or a new vehicle?',
    question: 'Is this a good astrological period for long drives, road trips or buying a new vehicle?',
  },
  {
    icon: ShieldAlert,
    label: 'Removing Travel Dosh',
    prompt: 'How do I protect against accidents or Rahu-Ketu dosh?',
    question: 'How do I protect myself and my vehicle against accidents or Rahu-Ketu related dosh?',
  },
];

function KundliChart() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" aria-hidden>
      <rect x="20" y="20" width="160" height="160" fill="none" stroke="#C9863F" strokeWidth="0.6" opacity="0.3" />
      <line x1="20" y1="20" x2="180" y2="180" stroke="#C9863F" strokeWidth="0.6" opacity="0.3" />
      <line x1="180" y1="20" x2="20" y2="180" stroke="#C9863F" strokeWidth="0.6" opacity="0.3" />
      <polygon points="100,20 180,100 100,180 20,100" fill="none" stroke="#C9863F" strokeWidth="0.6" opacity="0.3" />
      <circle cx="100" cy="100" r="94" fill="none" stroke="#C9863F" strokeWidth="0.4" opacity="0.18" />
    </svg>
  );
}

export function AcharyaVahanSection() {
  return (
    <section className="relative py-14 sm:py-20 bg-[#2B1B0C] overflow-hidden">
      <div
        className="absolute inset-0 opacity-60 warm-glow-bg"
      />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#9C5A26]/10 blur-[100px]" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#9C5A26]/40 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#9C5A26]/40 to-transparent" />
      <MandalaMotif className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] text-[#C9863F]/[0.04] animate-[spin_60s_linear_infinite] motion-reduce:animate-none" />

      <div className="relative max-w-5xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-10 lg:gap-16 items-center">
          <Reveal className="text-center lg:text-left">
            <div className="relative w-32 h-32 sm:w-40 sm:h-40 mx-auto lg:mx-0 mb-7 sm:mb-8">
              <div className="absolute inset-1 rounded-full bg-[#C9863F]/30 blur-2xl animate-pulse" />
              <div className="absolute inset-0 rounded-full animate-[spin_20s_linear_infinite] motion-reduce:animate-none opacity-40">
                <KundliChart />
              </div>
              <KundliChart />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-[#9C5A26]/50 bg-[#2B1B0C] shadow-[0_0_36px_rgba(201,134,63,0.3)] flex items-center justify-center">
                  <MoonStar className="w-6 h-6 sm:w-8 sm:h-8 text-[#C9863F]" strokeWidth={1.25} />
                </div>
              </div>
              <span className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-3.5 h-3.5 rounded-full bg-brand-success border-2 border-[#2B1B0C] animate-pulse" />
            </div>

            <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-3">
              Not Sure This Kavach Is Enough?
            </p>
            <h2
              className="tracking-tight text-[#E6D3AE] leading-[1.05] mb-4 text-3xl sm:text-4xl md:text-5xl"
              style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
            >
              Ask <span className="italic font-light text-[#E6B873]">Acharya Madhav</span>
            </h2>

            <p className="font-body text-sm text-[#B8A98A] leading-relaxed max-w-sm mx-auto lg:mx-0 mb-8">
              Every chart carries a different travel risk. Tell him your birth details and he&apos;ll tell you
              whether the Vahan Suraksha Kavach suits your chart — and what else, if anything, your roads need.
            </p>

            <button
              type="button"
              onClick={() => openChat('Does the Vahan Suraksha Kavach suit my chart for vehicle safety?')}
              className="border border-[#2B1B0C] shadow-neo-gold-md inline-flex items-center gap-2 rounded-lg bg-[#9C5A26] text-[#E6D3AE] px-7 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#C9863F] transition-colors duration-200"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Ask About My Chart
            </button>
          </Reveal>

          {/* Ask-about prompts — a horizontal snap-scroll row on mobile instead of being
              hidden outright, so phone visitors (most of this page's ad traffic) get the
              same quick-prompt shortcuts desktop does, not just the generic CTA above. */}
          <StaggerGroup className="flex sm:grid sm:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory -mx-6 px-6 sm:mx-0 sm:px-0">
            {ASK_ABOUT.map((d) => {
              const Icon = d.icon;
              return (
                <StaggerItem key={d.label} className="flex-shrink-0 w-[78vw] xs:w-[70vw] sm:w-auto snap-start">
                  <button
                    type="button"
                    onClick={() => openChat(d.question)}
                    className="group w-full h-full flex flex-col items-start gap-3 rounded-2xl border border-[#9C5A26]/20 bg-[#E6D3AE]/[0.03] p-5 hover:border-[#9C5A26]/60 hover:bg-[#E6D3AE]/[0.06] hover:-translate-y-1 transition-all duration-300 text-left"
                  >
                    <span className="w-10 h-10 rounded-full bg-[#9C5A26]/10 flex items-center justify-center group-hover:bg-[#9C5A26]/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      <Icon className="w-[18px] h-[18px] text-[#C9863F]" strokeWidth={1.5} />
                    </span>
                    <p className="font-heading font-black text-[11px] sm:text-sm uppercase tracking-tight text-[#E6D3AE]">
                      {d.label}
                    </p>
                    <p className="font-body text-xs sm:text-sm text-[#B8A98A]/70 leading-snug">&ldquo;{d.prompt}&rdquo;</p>
                  </button>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
