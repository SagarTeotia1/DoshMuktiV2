import Link from 'next/link';
import { MessageCircle, Mail, Instagram, Youtube, Clock } from 'lucide-react';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';

const WHATSAPP_NUMBER = '919999999999';
const SUPPORT_EMAIL = 'support@doshhmukti.com';

const CHANNELS = [
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    detail: 'Fastest way to reach us — usually within the hour',
    href: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Namaste 🙏 I have a question about my order.')}`,
    cta: 'Chat on WhatsApp',
  },
  {
    icon: Mail,
    label: 'Email',
    detail: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    cta: 'Send an Email',
  },
  {
    icon: Instagram,
    label: 'Instagram',
    detail: '@doshhmukti',
    href: 'https://instagram.com/doshhmukti',
    cta: 'Follow Us',
  },
  {
    icon: Youtube,
    label: 'YouTube',
    detail: '@doshhmukti',
    href: 'https://youtube.com/@doshhmukti',
    cta: 'Watch Videos',
  },
];

export const metadata = { title: 'Contact — Doshhmukti' };

export default function ContactPage() {
  return (
    <>
      <section className="relative bg-[#2B1B0C] overflow-hidden py-14 sm:py-20">
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(156,90,38,0.22), transparent 55%)' }}
        />
        <MandalaMotif className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 text-[#C9863F]/[0.06]" />

        <Reveal className="relative max-w-2xl mx-auto px-6 text-center">
          <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-3">
            Get In Touch
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#E6D3AE] leading-[1.05] mb-4">
            We&apos;re Here To Help
          </h1>
          <p className="font-body text-sm sm:text-base text-[#B8A98A] leading-relaxed max-w-md mx-auto">
            Order questions, product guidance, or just curious — reach out on whichever channel is easiest for you.
          </p>
        </Reveal>
      </section>

      <section className="py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12">
          <StaggerGroup className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-12 sm:mb-16">
            {CHANNELS.map((c) => {
              const Icon = c.icon;
              return (
                <StaggerItem key={c.label}>
                  <Link
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-xl border border-[#2B1B0C]/12 bg-white p-5 sm:p-6 hover:border-[#9C5A26] hover:shadow-neo-md transition-all duration-300"
                  >
                    <span className="flex-shrink-0 w-12 h-12 rounded-full bg-[#F6E4C2] flex items-center justify-center group-hover:bg-[#9C5A26]/15 transition-colors duration-300">
                      <Icon className="w-5 h-5 text-[#9C5A26]" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-heading font-bold text-sm text-[#2B1B0C]">{c.label}</h3>
                      <p className="font-body text-xs text-[#8A7A63] truncate">{c.detail}</p>
                    </div>
                    <span className="flex-shrink-0 font-body text-xs font-bold uppercase tracking-widest text-[#9C5A26] group-hover:text-[#2B1B0C] transition-colors duration-300">
                      {c.cta} →
                    </span>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGroup>

          <Reveal className="flex items-center justify-center gap-2.5 text-center">
            <Clock className="w-4 h-4 text-[#9C5A26] flex-shrink-0" strokeWidth={1.75} />
            <p className="font-body text-sm text-[#6B5539]">
              Support hours: <span className="font-bold text-[#2B1B0C]">Mon–Sat, 10 AM – 7 PM IST</span>
            </p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
