import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Car } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import { SITE_URL, RETURN_ELIGIBLE_ABOVE } from '@/lib/constants';
import { CampaignHeader } from './campaign-header';
import { BuyNowButton } from './buy-now-button';
import type { Product, DescriptionBlock } from '@/types/api.types';

// A one-product campaign page, not the regular PDP — deliberately outside the
// (storefront) route group so it skips the catalog Navbar/Footer/AnnouncementBar and
// gets its own minimal chrome (see campaign-header.tsx). Buying still goes through the
// exact same buy-now cart + /checkout + login flow every other product page uses.
const PRODUCT_SLUG = 'vahan-suraksha-kavach';

const STATS = [
  { value: '100%', label: 'Ritually Energized' },
  { value: '24-48h', label: 'Dispatch Time' },
  { value: '5-7', label: 'Days to Deliver' },
  { value: '7-Day', label: `Returns ₹${RETURN_ELIGIBLE_ABOVE}+` },
];

const FAQ_ITEMS = [
  {
    q: 'Is the Kavach really energized before shipping?',
    a: 'Yes — every Vahan Suraksha Kavach is ritually energized following traditional Vedic practice before it leaves our workshop, the same process used across every Doshhmukti product.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Orders are dispatched within 24-48 hours and typically arrive within 5-7 business days anywhere in India, via Delhivery.',
  },
  {
    q: 'What if I want to return it?',
    a: `Eligible orders of ₹${RETURN_ELIGIBLE_ABOVE} and above (this Kavach qualifies) come with a 7-day change-of-mind return window from delivery. Damaged or incorrect items are replaced free within 48 hours, regardless of price.`,
  },
  {
    q: 'What payment methods are accepted?',
    a: 'UPI, debit/credit cards, net banking and EMI — all processed securely through Razorpay.',
  },
  {
    q: 'Where do I place it in my vehicle?',
    a: 'Most customers tuck it into the dashboard or glovebox, though anywhere inside the vehicle works — it travels with the vehicle, not a specific seat.',
  },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Place Your Order', body: 'Buy takes you straight to secure checkout — no separate account setup.' },
  { step: '02', title: 'Energized & Packed', body: 'Your Kavach is ritually energized and carefully packed before dispatch.' },
  { step: '03', title: 'Delivered & Ready', body: "Arrives within 5-7 days — place it in your vehicle and you're set." },
];

interface ProductDetailResponse {
  product: Product;
}

async function getProduct(): Promise<Product | null> {
  try {
    const data = await api.get<ProductDetailResponse>(`/api/products/${PRODUCT_SLUG}`);
    return data.product;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const product = await getProduct();
  if (!product) return {};

  const title = 'Vahan Suraksha Kavach — Protection for Every Journey';
  const description =
    product.excerpt || 'A ritually energized Vahan Suraksha Kavach for your vehicle — invoked for safe roads and steady journeys.';
  const canonical = `/${PRODUCT_SLUG}`;
  const image = product.images[0]?.card;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: `${SITE_URL}${canonical}`, type: 'website', images: image ? [{ url: image }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function VahanSurakshaKavachPage() {
  const product = await getProduct();
  if (!product) notFound();

  const activeVariants = product.variants.filter((v) => v.isActive && v.attributes.type !== 'service');
  const variant = activeVariants[0] ?? null;
  // Prisma Decimal fields (basePrice/priceOverride/compareAtPrice) serialize over JSON as
  // strings, not numbers — Number(...) here is required, or `"1499" > "599"` below does a
  // lexicographic string compare instead of a numeric one and silently always loses.
  const price = Number(variant ? (variant.priceOverride ?? product.basePrice) : product.basePrice);
  const compareAtPrice = product.compareAtPrice !== null ? Number(product.compareAtPrice) : null;
  const mrp = compareAtPrice !== null && compareAtPrice > price ? compareAtPrice : null;
  const discountPct = mrp ? Math.round(((mrp - price) / mrp) * 100) : null;
  const soldOut = !variant || variant.stockQuantity === 0;
  const maxQty = Math.max(1, Math.min(variant?.stockQuantity ?? 1, 10));
  const heroImage = product.images[0]?.full ?? product.images[0]?.card ?? null;

  const descriptionParagraphs = product.description.filter(
    (b): b is Extract<DescriptionBlock, { type: 'text' }> => b.type === 'text'
  );
  const descriptionImages = product.description.filter(
    (b): b is Extract<DescriptionBlock, { type: 'image' }> => b.type === 'image'
  );
  const fullDescription = descriptionParagraphs.map((b) => b.content).join(' ');
  // The real, admin-authored copy's second sentence stands alone as the big pull-quote
  // statement below — short enough to actually work at giant type size, unlike the full
  // paragraph. Falls back to the whole thing if it was ever written as a single sentence.
  const pullQuote = fullDescription.split(/(?<=[.!?])\s+/)[1] ?? fullDescription;

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: heroImage ? [heroImage] : undefined,
    description: product.excerpt || fullDescription,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price,
      availability: soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url: `${SITE_URL}/products/${product.slug}`,
    },
  };

  return (
    <div className="bg-[#FFFDF8] text-[#2B1B0C]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />

      {variant && <CampaignHeader variantId={variant.id} productName={product.name} price={price} />}

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-5 pt-24 pb-16 sm:pt-28">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#9C5A26]/15 blur-[120px]" />

        <div className="relative flex flex-col items-center text-center max-w-3xl mx-auto animate-fade-in-up">
          <span className="font-body text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-[#9C5A26] mb-5">
            Vedic Protection Ritual
          </span>
          <h1 className="font-heading font-black text-5xl sm:text-7xl lg:text-8xl leading-[0.95] tracking-tight mb-5">
            Vahan Suraksha
            <br />
            Kavach
          </h1>
          <p className="font-body text-base sm:text-lg text-[#6B5539] max-w-md mb-10">
            Invoked for safe roads and steady journeys — wherever the road takes you.
          </p>

          {!soldOut && variant ? (
            <BuyNowButton variantId={variant.id} productName={product.name} price={price} maxQty={maxQty} />
          ) : (
            <span className="inline-flex items-center justify-center rounded-full border border-[#2B1B0C]/20 text-[#8A7A63] font-bold text-sm py-3.5 px-8">
              Currently Out of Stock
            </span>
          )}
        </div>

        <div className="relative w-full max-w-lg mt-14 sm:mt-20">
          <div className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-[#F6E4C2] shadow-[0_40px_90px_-20px_rgba(43,27,12,0.35)] animate-float">
            {heroImage ? (
              <Image src={heroImage} alt={product.name} fill className="object-cover" priority sizes="(min-width: 640px) 512px, 90vw" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#8A7A63]">
                <Car className="w-16 h-16" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="font-heading text-2xl font-black tabular-nums">{formatCurrency(price)}</span>
            {mrp && (
              <>
                <span className="text-sm text-[#8A7A63] line-through">{formatCurrency(mrp)}</span>
                <span className="font-body text-xs font-bold text-[#B23A2E]">{discountPct}% off</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ─── Big statement — real, admin-authored copy at giant scale ────────── */}
      <section className="bg-[#2B1B0C] text-[#E6D3AE] px-5 py-28 sm:py-40">
        <Reveal className="max-w-4xl mx-auto text-center">
          <p className="font-heading font-black text-3xl sm:text-5xl lg:text-6xl leading-[1.1] tracking-tight">{pullQuote}</p>
        </Reveal>
      </section>

      {/* ─── Feature image + caption ──────────────────────────────────────── */}
      <section className="px-5 py-24 sm:py-32">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-10">
          <Reveal>
            <h2 className="font-heading font-black text-3xl sm:text-5xl tracking-tight leading-[1.1]">
              Tucked into the dashboard.
              <br />
              Or the glovebox.
            </h2>
          </Reveal>
          {descriptionImages[0] && (
            <Reveal delay={0.1} className="w-full max-w-lg">
              <div className="rounded-[2rem] overflow-hidden relative aspect-[4/3] shadow-[0_30px_70px_-25px_rgba(43,27,12,0.3)]">
                <Image src={descriptionImages[0].full} alt={product.name} fill className="object-cover" />
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ─── Stat strip ───────────────────────────────────────────────────── */}
      <section className="border-y border-[#2B1B0C]/10 bg-[#F6E4C2]/40 px-5 py-16 sm:py-20">
        <StaggerGroup className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-6">
          {STATS.map((s) => (
            <StaggerItem key={s.label} className="flex flex-col items-center text-center">
              <span className="font-heading font-black text-3xl sm:text-4xl text-[#9C5A26] tabular-nums">{s.value}</span>
              <span className="font-body text-[11px] sm:text-xs font-bold uppercase tracking-wide text-[#6B5539] mt-2">{s.label}</span>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* ─── Full description, in full ───────────────────────────────────── */}
      {fullDescription && (
        <section className="bg-[#2B1B0C] text-[#E6D3AE] px-5 py-24 sm:py-32">
          <Reveal className="max-w-2xl mx-auto text-center">
            <p className="font-body text-base sm:text-lg leading-relaxed text-[#E6D3AE]/80">{fullDescription}</p>
          </Reveal>
        </section>
      )}

      {/* ─── How it works ─────────────────────────────────────────────────── */}
      <section className="px-5 py-24 sm:py-32">
        <Reveal>
          <h2 className="font-heading font-black text-3xl sm:text-5xl tracking-tight text-center mb-16">From Order to Road-Ready</h2>
        </Reveal>
        <StaggerGroup className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-10 sm:gap-8">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <StaggerItem key={step} className="flex flex-col items-center text-center gap-3">
              <span className="font-heading font-black text-6xl text-[#9C5A26]/20">{step}</span>
              <h3 className="font-heading font-bold text-base">{title}</h3>
              <p className="font-body text-sm text-[#6B5539] leading-relaxed max-w-[220px]">{body}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      {/* ─── FAQ — plain, understated dividers, not a bordered card ──────────── */}
      <section className="px-5 py-24 sm:py-32">
        <Reveal>
          <h2 className="font-heading font-black text-3xl sm:text-5xl tracking-tight text-center mb-14">Common Questions</h2>
        </Reveal>
        <Reveal delay={0.1} className="max-w-2xl mx-auto flex flex-col divide-y divide-[#2B1B0C]/10">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group py-6">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-heading font-bold text-sm sm:text-base">
                {item.q}
                <span className="flex-shrink-0 text-[#9C5A26] text-xl leading-none transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="font-body text-sm text-[#6B5539] leading-relaxed mt-3 max-w-xl">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────────── */}
      {!soldOut && variant && (
        <section className="bg-[#2B1B0C] text-[#E6D3AE] px-5 py-28 sm:py-36">
          <Reveal className="max-w-lg mx-auto flex flex-col items-center text-center gap-6">
            <h2 className="font-heading font-black text-3xl sm:text-5xl tracking-tight">Protection, wherever you drive.</h2>
            <BuyNowButton variantId={variant.id} productName={product.name} price={price} maxQty={maxQty} tone="dark" />
          </Reveal>
        </section>
      )}

      {/* ─── Minimal footer — a thin line back to the real site, not the full mega-footer ── */}
      <footer className="px-5 py-8 border-t border-[#2B1B0C]/10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="font-body text-xs text-[#8A7A63]">© {new Date().getFullYear()} Doshhmukti. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs font-body text-[#8A7A63]">
            <Link href="/terms" className="hover:text-[#9C5A26] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[#9C5A26] transition-colors">
              Privacy
            </Link>
            <Link href="/" className="hover:text-[#9C5A26] transition-colors">
              Explore the full collection
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
