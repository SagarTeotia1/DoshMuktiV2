import Link from 'next/link';
import { MessageCircle, MoonStar, Heart, TrendingUp, ShieldCheck } from 'lucide-react';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';

const WHATSAPP_NUMBER = '919999999999';

function waLink(question: string) {
  const message = encodeURIComponent(`Namaste Acharya Madhav 🙏 ${question}`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

const DOMAINS = [
  {
    icon: Heart,
    label: 'Love & Relationships',
    prompt: 'Which stone will help me in love and relationships?',
    question: 'Which stone or ritual will help me in love and relationships?',
  },
  {
    icon: TrendingUp,
    label: 'Wealth & Career',
    prompt: 'Is this a good time to invest or change my career?',
    question: 'Based on my numerology, is this a good time to invest or change my career?',
  },
  {
    icon: ShieldCheck,
    label: 'Health & Protection',
    prompt: 'How do I remove Shani dosh or negative energy?',
    question: 'How do I remove Shani dosh or protect myself from negative energy?',
  },
];

/** North Indian kundli chart construction — outer square, both diagonals, and the
 * inner diamond joining edge-midpoints. Purely decorative, but recognizable to
 * anyone who has seen a birth chart, and reads as elegant geometry to everyone else. */
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

export function AcharyaMadhavSection() {
  return (
    <section className="relative py-10 sm:py-14 bg-[#2B1B0C] overflow-hidden">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(156,90,38,0.22), transparent 55%)',
        }}
      />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#9C5A26]/40 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#9C5A26]/40 to-transparent" />
      <MandalaMotif className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] text-[#C9863F]/[0.04] animate-[spin_60s_linear_infinite]" />

      <div className="relative max-w-5xl mx-auto px-6 sm:px-10 lg:px-12">
        <div className="grid lg:grid-cols-[auto_1fr] gap-10 lg:gap-16 items-center">
          {/* Left — avatar + copy */}
          <Reveal className="text-center lg:text-left">
            <div className="relative w-32 h-32 sm:w-36 sm:h-36 mx-auto lg:mx-0 mb-7 sm:mb-8">
              <div className="absolute inset-2 rounded-full bg-[#C9863F]/25 blur-xl animate-pulse" />
              <div className="absolute inset-0 rounded-full animate-[spin_20s_linear_infinite] opacity-40">
                <KundliChart />
              </div>
              <KundliChart />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 sm:w-[4.75rem] sm:h-[4.75rem] rounded-full border border-[#9C5A26]/50 bg-[#2B1B0C] shadow-[0_0_30px_rgba(201,134,63,0.25)] flex items-center justify-center">
                  <MoonStar className="w-6 h-6 sm:w-7 sm:h-7 text-[#C9863F]" strokeWidth={1.25} />
                </div>
              </div>
              <span className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#2B1B0C] animate-pulse" />
            </div>

            <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] text-[#9C5A26] mb-3">
              Ancient Wisdom, On Demand
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#FBF1DF] leading-[1.05] mb-4">
              Acharya Madhav
            </h2>

            <p className="font-body text-sm text-[#B8A98A] leading-relaxed max-w-sm mx-auto lg:mx-0 mb-8">
              Tell him what&apos;s on your mind — love, money, career, health. He reads your birth details through
              Vedic astrology and numerology, and tells you exactly what to wear.
            </p>

            <Link
              href={waLink("I'd like a personalized recommendation based on my Vedic astrology / numerology.")}
              target="_blank"
              rel="noopener noreferrer"
              className="brutal-border brutal-shadow-light inline-flex items-center gap-2 rounded-full bg-[#9C5A26] text-[#FBF1DF] px-7 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#C9863F] transition-colors duration-200"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat with Acharya Madhav
            </Link>
          </Reveal>

          {/* Right — ask him about, as cards */}
          <StaggerGroup className="grid sm:grid-cols-3 gap-3 sm:gap-4">
            {DOMAINS.map((d) => {
              const Icon = d.icon;
              return (
                <StaggerItem key={d.label}>
                  <Link
                    href={waLink(d.question)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col items-start gap-3 rounded-xl border border-[#9C5A26]/20 bg-[#FBF1DF]/[0.03] p-5 hover:border-[#9C5A26]/60 hover:bg-[#FBF1DF]/[0.06] hover:-translate-y-1 transition-all duration-300"
                  >
                    <span className="w-10 h-10 rounded-full bg-[#9C5A26]/10 flex items-center justify-center group-hover:bg-[#9C5A26]/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      <Icon className="w-[18px] h-[18px] text-[#C9863F]" strokeWidth={1.5} />
                    </span>
                    <p className="font-heading text-[13px] font-bold uppercase tracking-wide text-[#FBF1DF]">
                      {d.label}
                    </p>
                    <p className="font-body text-[12px] text-[#B8A98A]/70 leading-snug">&ldquo;{d.prompt}&rdquo;</p>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
