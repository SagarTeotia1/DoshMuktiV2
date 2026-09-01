import type { Metadata } from 'next';
import Link from 'next/link';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { Reveal } from '@/components/motion/Reveal';
import { SITE_URL } from '@/lib/constants';

const TITLE = 'FAQ — Gemstones, Astrology Remedies & Wealth Jewellery';
const DESCRIPTION =
  'Answers on choosing gemstones for love and wealth, how astrology remedies work, energizing rituals, authenticity, shipping and returns — everything before you buy from Doshhmukti.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/faq' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/faq`, type: 'website' },
};

// Every question here is a real query pattern (Google PAA / voice / AI-chat phrasing),
// answered in 1-3 self-contained sentences immediately below the heading — snippet-
// and LLM-extractable without needing the rest of the page for context.
const FAQS = [
  {
    q: 'Which gemstone is best for attracting wealth?',
    a: 'In Vedic astrology, Yellow Sapphire (Pukhraj) and Pyrite are the two most commonly recommended stones for wealth and financial growth — Pukhraj strengthens Jupiter (the planet of abundance and luck), while Pyrite is worn or kept at home/desk as a magnet for opportunity and cash flow. The right choice depends on your birth chart, which is why we recommend a quick check with Acharya Madhav before buying.',
  },
  {
    q: 'Which gemstone or bracelet is best for love and relationships?',
    a: 'Rose Quartz is the classic stone for love, self-worth, and relationship harmony, and Moonstone is often paired with it for emotional balance. Both are available as bracelets and malas in our Love & Relationships collection.',
  },
  {
    q: 'How do I know which gemstone is right for my birth chart?',
    a: 'The right gemstone depends on your weak or afflicted planets, which only a birth-chart (kundli) reading can show. Message Acharya Madhav with your date, time, and place of birth via WhatsApp or the chat widget on this site for a free, personalized recommendation.',
  },
  {
    q: 'How can I increase wealth using astrology?',
    a: 'Vedic astrology ties wealth to Jupiter, Venus and the 2nd/11th houses of your chart. Common remedies include wearing a wealth-aligned gemstone (Pukhraj or Pyrite), keeping a Kuber Yantra or Laughing Buddha at your workspace, and performing simple daily rituals like lighting a ghee lamp on Thursdays. These are supportive remedies, not guarantees — they work alongside real financial effort, not instead of it.',
  },
  {
    q: 'Are Doshhmukti gemstones and rudraksha authentic?',
    a: 'Yes. Every rudraksha, gemstone, and mala is sourced directly from verified artisans, not mass-produced imitations, and each product page states its material clearly. We do not sell lab-created stones as natural without disclosure.',
  },
  {
    q: 'What does "energized" or "sidhi" mean for a product?',
    a: 'Energizing (prana pratishtha) is a traditional Vedic ritual performed on each piece before it ships, intended to activate the stone\'s properties before you start wearing it. Some products also offer a paid self-energizing option with printed instructions if you prefer to perform the ritual yourself on arrival.',
  },
  {
    q: 'How do I wear or activate a gemstone bracelet for the first time?',
    a: 'Most products include specific "How to Wear & Recharge" steps on their product page — typically worn on a specific hand/finger, on a specific day of the week, after a short cleansing ritual. Follow the steps on your exact product page, since timing and hand differ by stone.',
  },
  {
    q: 'Does Doshhmukti offer AI or astrology chat guidance?',
    a: 'Yes — the chat widget on this site and our WhatsApp line connect you to AI-assisted, astrology-informed guidance modeled on Acharya Madhav\'s approach, so you can ask what stone or remedy fits your goal (love, wealth, health, career, protection) before you buy.',
  },
  {
    q: 'How long does shipping take?',
    a: 'Orders are dispatched within 24-48 hours and typically arrive within 5-7 business days across India. Free shipping applies on orders above ₹999.',
  },
  {
    q: 'What is the return policy?',
    a: 'Damaged or incorrect items can be reported within 48 hours of delivery for a free replacement. See each product page for item-specific return notes.',
  },
] as const;

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function FAQPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <section className="relative bg-[#2B1B0C] overflow-hidden py-14 sm:py-20">
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(156,90,38,0.22), transparent 55%)' }}
        />
        <MandalaMotif className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 text-[#C9863F]/[0.06]" />

        <Reveal className="relative max-w-2xl mx-auto px-6 text-center">
          <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-3">
            Frequently Asked
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[#E6D3AE] leading-[1.05] mb-4">
            Gemstones, Wealth &amp; Love Remedies — Explained
          </h1>
          <p className="font-body text-sm sm:text-base text-[#B8A98A] leading-relaxed max-w-xl mx-auto">
            Straight answers on choosing the right stone for love or wealth, how astrology remedies work, and what
            to expect before you order.
          </p>
        </Reveal>
      </section>

      <section className="py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex flex-col divide-y divide-[#2B1B0C]/10">
            {FAQS.map((f) => (
              <div
                key={f.q}
                id={f.q.startsWith('How long does shipping') ? 'shipping' : f.q.startsWith('What is the return') ? 'returns' : undefined}
                className="py-6 scroll-mt-24"
              >
                <h2 className="font-heading font-bold text-base sm:text-lg text-[#2B1B0C] mb-2">{f.q}</h2>
                <p className="font-body text-sm text-[#6B5539] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="font-body text-sm text-[#8A7A63] mb-4">Still not sure which stone fits your chart?</p>
            <Link
              href="/shop?purpose=wealth"
              className="inline-flex items-center gap-2 rounded-full bg-[#9C5A26] text-[#E6D3AE] px-6 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#C9863F] hover:text-[#2B1B0C] transition-colors duration-200 mr-3"
            >
              Shop Wealth Remedies
            </Link>
            <Link
              href="/shop?purpose=love"
              className="inline-flex items-center gap-2 rounded-full border border-[#2B1B0C] text-[#2B1B0C] px-6 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#2B1B0C] hover:text-[#E6D3AE] transition-colors duration-200"
            >
              Shop Love Remedies
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
