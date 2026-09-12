import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Fraunces } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import { Car, ShieldCheck, Sparkles, Compass, Flame, HeartHandshake, Truck, RotateCcw, Lock } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { StaggerGroup, StaggerItem } from '@/components/motion/Stagger';
import { MandalaMotif } from '@/components/motion/MandalaMotif';
import { ProductRail } from '@/components/storefront/ProductRail';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import { SITE_URL, RETURN_ELIGIBLE_ABOVE, FREE_SHIPPING_ABOVE } from '@/lib/constants';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { Footer } from '@/components/layout/Footer';
import { CampaignHeader } from './campaign-header';
import { BuyNowButton } from './buy-now-button';
import { AcharyaVahanSection } from './acharya-vahan-section';
import { ReviewsSection } from '../(storefront)/products/[slug]/reviews-section';
import type { Product, DescriptionBlock, PaginatedProducts } from '@/types/api.types';

// A one-product campaign page, not the regular PDP — deliberately outside the
// (storefront) route group so it skips the catalog Navbar/Footer/AnnouncementBar and
// gets its own minimal chrome (see campaign-header.tsx). Buying still goes through the
// exact same buy-now cart + /checkout + login flow every other product page uses.
const PRODUCT_SLUG = 'vahan-suraksha-kavach';

// A serif display face, scoped to this campaign page only (next/font/google works from
// any Server Component, not just root layout) — the rest of the site runs on Outfit/Satoshi
// per docs/DESIGN.md; this page wants a slower, more editorial headline register than that
// sans-only system gives, without touching the global font setup other pages depend on.
const fraunces = Fraunces({ subsets: ['latin'], weight: ['400', '600'], style: ['normal', 'italic'], variable: '--font-fraunces' });

const HERO_SERVICES = [
  { icon: Sparkles, label: '100% Ritually Energized' },
  { icon: Truck, label: `Free Delivery ₹${FREE_SHIPPING_ABOVE}+` },
  { icon: RotateCcw, label: `7-Day Returns ₹${RETURN_ELIGIBLE_ABOVE}+` },
  { icon: Lock, label: 'Secure Payment' },
];

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
    a: 'UPI, debit/credit cards, net banking and EMI — all processed securely through HDFC SmartGateway.',
  },
  {
    q: 'Where do I place it in my vehicle?',
    a: 'Most customers tuck it into the dashboard or glovebox, though anywhere inside the vehicle works — it travels with the vehicle, not a specific seat.',
  },
];

// Cycled icons for the benefits grid — the copy itself comes from the product's own
// admin-authored `benefits` field, these are purely decorative per-card accents.
const BENEFIT_ICONS = [ShieldCheck, Compass, Flame, Sparkles, HeartHandshake, Car];

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

// "You May Also Need" rail near the bottom — same protection/safety purpose this
// product sits under, so it reads as a sensible next pick rather than a random rail.
// Never allowed to crash the page: any failure just collapses the section to empty.
async function getRelatedProducts(currentSlug: string): Promise<Product[]> {
  try {
    const params = new URLSearchParams({ purpose: 'protection', sort: 'newest', limit: '9' });
    const data = await api.get<PaginatedProducts>(`/api/products?${params.toString()}`);
    return data.products.filter((p) => p.slug !== currentSlug).slice(0, 8);
  } catch {
    return [];
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

  // Real benefit copy from the product record — falls back to a minimal, honest set
  // derived from the same excerpt/description data if the admin hasn't filled `benefits`
  // in yet, so the section never invents claims the product data doesn't support.
  const benefits =
    product.benefits.length > 0
      ? product.benefits
      : [
          { title: 'Ritually Energized', description: product.excerpt || 'Invoked with traditional Vedic ritual before it ever leaves our workshop.' },
          { title: 'Travels With the Vehicle', description: 'Tuck it into the dashboard or glovebox — it protects the journey, not a seat.' },
          { title: 'Built for Every Road', description: 'Invoked for safe roads and steady journeys, wherever the road takes you.' },
        ];

  const relatedProducts = await getRelatedProducts(product.slug);

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
    // Google requires an actual review count for aggregateRating — omitting it
    // entirely (rather than sending 0/0) avoids a "missing field" rich-results error
    // on products that don't have reviews yet.
    ...(product.rating.count > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating.average,
        reviewCount: product.rating.count,
      },
    }),
  };

  // FAQ_ITEMS is already rendered as a visible accordion below — this schema is
  // what makes it eligible for Google's FAQ rich-result snippet under the SERP entry.
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <div className={`${fraunces.variable} bg-[#FFFDF8] text-[#2B1B0C] overflow-x-hidden`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {variant && <CampaignHeader variantId={variant.id} productName={product.name} price={price} />}

      {/* ─── Hero — solid ink canvas, product photo floating on it (not full-bleed cover),
          giant serif headline overlapping the image's base, a segmented glass bar of
          feature promises + CTA closing the section. Composition, not colorway, borrowed
          from a "product-hero" reference the client liked — this stays Temple Warmth bronze. */}
      <section className="relative bg-[#2B1B0C] overflow-hidden pt-24 sm:pt-28">
        <div className="pointer-events-none absolute top-[-15%] left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full bg-[#9C5A26]/20 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 right-[-10%] w-[420px] h-[420px] rounded-full bg-[#C9863F]/15 blur-[110px]" />
        <MandalaMotif
          petals={20}
          className="pointer-events-none absolute top-[8%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] text-[#E6D3AE]/[0.05] animate-[spin_90s_linear_infinite] motion-reduce:animate-none"
        />

        <span className="relative z-10 block text-center font-body text-[11px] sm:text-xs font-bold uppercase tracking-[0.35em] text-[#E6B873] mb-8 sm:mb-10">
          Vedic Protection Ritual
        </span>

        {/* Product image, badge and sticker tag all live INSIDE the image's own box — the
            reference's overlap trick only works because its product is a transparent
            cutout; ours is an opaque studio photo, so nothing here is allowed to spill
            past the image edge into the headline below it (that was the overlap bug). */}
        <div className="relative mx-auto max-w-[min(480px,80vw)] sm:max-w-[440px]">
          <div className="relative z-10 aspect-square rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-[0_40px_90px_-25px_rgba(0,0,0,0.55)] sm:shadow-[0_60px_120px_-30px_rgba(0,0,0,0.55)] animate-float motion-reduce:animate-none">
            {heroImage ? (
              <Image src={heroImage} alt={product.name} fill className="object-cover" priority sizes="(min-width: 640px) 440px, 80vw" />
            ) : (
              <div className="w-full h-full bg-[#F6E4C2] flex items-center justify-center text-[#8A7A63]">
                <Car className="w-20 h-20" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#2B1B0C]/25 via-transparent to-transparent" />

            {/* Rotating circular badge — "seal of authenticity", pinned inside the frame so it
                can never intrude on the headline no matter the viewport */}
            <div className="hidden sm:block absolute left-3 bottom-3 z-20 w-[4.5rem] h-[4.5rem]">
              <svg viewBox="0 0 100 100" className="w-full h-full animate-[spin_18s_linear_infinite] motion-reduce:animate-none">
                <defs>
                  <path id="vsk-badge-circle" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
                </defs>
                <circle cx="50" cy="50" r="49" fill="#2B1B0Ccc" stroke="#E6D3AE55" strokeWidth="1" />
                <text fill="#E6B873" fontSize="8.2" fontWeight="700" letterSpacing="1.5">
                  <textPath href="#vsk-badge-circle" startOffset="0%">
                    VEDIC RITUAL • ENERGIZED •&nbsp;
                  </textPath>
                </text>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-[#E6B873]" strokeWidth={1.5} />
              </span>
            </div>

            {/* Sticker tag — small rotated pill, kept inside the top-right corner */}
            <span className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 rotate-[8deg] inline-flex items-center rounded-full bg-[#E6B873] text-[#2B1B0C] font-body font-bold text-[10px] sm:text-[11px] px-3 py-1.5 shadow-neo-gold-md">
              100% Energized
            </span>
          </div>
        </div>

        {/* Headline — clears the image with real, positive spacing; giant serif italic accent */}
        <div className="relative z-10 px-5 sm:px-10 mt-10 sm:mt-14">
          <Reveal className="max-w-4xl mx-auto text-center sm:text-left">
            <h1
              className="leading-[1.05] sm:leading-[0.98] tracking-tight text-[#FFFDF8] text-[2.1rem] sm:text-6xl lg:text-7xl"
              style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
            >
              Because your journey <span className="italic font-light text-[#E6B873]">deserves</span> protection.
            </h1>
            <p className="font-body text-sm sm:text-base text-[#E6D3AE]/80 max-w-md mx-auto sm:mx-0 mt-5">
              Invoked for safe roads and steady journeys — wherever the road takes you.
            </p>
          </Reveal>
        </div>

        {/* Segmented glass bar — feature promises, price, and the buy CTA in one strip */}
        <div className="relative z-10 px-5 sm:px-10 mt-9 sm:mt-12 pb-10 sm:pb-14">
          <StaggerGroup className="max-w-5xl mx-auto flex flex-col sm:flex-row items-stretch rounded-3xl sm:rounded-full border border-[#E6D3AE]/15 bg-[#FFFDF8]/[0.06] backdrop-blur-md divide-y sm:divide-y-0 sm:divide-x divide-[#E6D3AE]/10 overflow-hidden">
            {HERO_SERVICES.map((s) => {
              const Icon = s.icon;
              return (
                <StaggerItem key={s.label} className="flex-1">
                  <div className="h-full flex items-center gap-2.5 px-4 sm:px-5 py-3.5 sm:py-4">
                    <Icon className="w-4 h-4 text-[#E6B873] flex-shrink-0" strokeWidth={1.75} />
                    <span className="font-body text-[11px] sm:text-xs font-bold text-[#E6D3AE] leading-tight">{s.label}</span>
                  </div>
                </StaggerItem>
              );
            })}
            <StaggerItem className="flex-shrink-0">
              <div className="h-full flex items-center gap-4 px-4 sm:px-6 py-4 sm:py-3">
                <span className="hidden sm:flex items-baseline gap-2">
                  <span className="font-heading text-lg font-black tabular-nums text-[#FFFDF8]">{formatCurrency(price)}</span>
                  {mrp && <span className="text-xs text-[#E6D3AE]/50 line-through">{formatCurrency(mrp)}</span>}
                </span>
                {!soldOut && variant ? (
                  <BuyNowButton variantId={variant.id} productName={product.name} price={price} maxQty={maxQty} tone="dark" />
                ) : (
                  <span className="inline-flex items-center justify-center rounded-full border border-[#E6D3AE]/30 text-[#E6D3AE]/70 font-bold text-sm py-3.5 px-8">
                    Currently Out of Stock
                  </span>
                )}
              </div>
            </StaggerItem>
          </StaggerGroup>

          <p className="text-center mt-5">
            <Link
              href="/shop"
              className="font-body text-sm font-bold text-[#E6D3AE] underline decoration-[#E6B873]/50 underline-offset-4 hover:text-[#FFFDF8] hover:decoration-[#E6B873] transition-colors"
            >
              Explore Full Collection →
            </Link>
          </p>
        </div>
      </section>

      {/* ─── Benefits — equal-size cards (a bento layout with one enlarged "featured"
          card read as broken/mismatched, not intentional, so every card here is now the
          same footprint regardless of copy length). ──────────────────────────────────── */}
      <section className="relative px-5 py-24 sm:py-32 overflow-hidden">
        <div className="pointer-events-none absolute top-10 right-[-8%] w-72 h-72 rounded-full bg-[#9C5A26]/[0.06] blur-[100px]" />

        <Reveal className="max-w-2xl mx-auto text-center mb-14 sm:mb-16">
          <span className="inline-flex items-center gap-2 font-body text-[11px] sm:text-xs font-bold uppercase tracking-[0.3em] text-[#9C5A26] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9C5A26]" />
            Why This Kavach
            <span className="w-1.5 h-1.5 rounded-full bg-[#9C5A26]" />
          </span>
          <h2
            className="tracking-tight leading-[1.08] text-3xl sm:text-5xl text-[#2B1B0C]"
            style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
          >
            Protection built into <span className="italic font-light text-[#9C5A26]">every drive.</span>
          </h2>
        </Reveal>

        <StaggerGroup className="relative max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
          {benefits.map((b, i) => {
            const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length] ?? ShieldCheck;
            return (
              <StaggerItem key={b.title} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-[1.75rem] border border-[#2B1B0C]/10 bg-[#FFFDF8] shadow-neo-sm hover:shadow-neo-lg hover:-translate-y-1 transition-all duration-300 p-6 sm:p-7 flex flex-col gap-4">
                  <span
                    aria-hidden
                    className="absolute -right-3 -bottom-5 font-heading font-black leading-none select-none pointer-events-none text-7xl text-[#9C5A26]/[0.06]"
                  >
                    0{i + 1}
                  </span>

                  <span className="relative z-10 flex-shrink-0 w-12 h-12 rounded-2xl bg-[#F6E4C2] flex items-center justify-center transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
                    <Icon className="w-5 h-5 text-[#9C5A26]" strokeWidth={1.5} />
                  </span>

                  <div className="relative z-10">
                    <h3 className="font-heading font-bold text-base sm:text-lg text-[#2B1B0C] mb-1.5">{b.title}</h3>
                    <p className="font-body text-sm text-[#6B5539] leading-relaxed">{b.description}</p>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </section>

      {/* ─── Big statement — real, admin-authored copy at giant scale ────────── */}
      <section className="relative bg-[#2B1B0C] text-[#E6D3AE] px-5 py-28 sm:py-40 overflow-hidden">
        <MandalaMotif className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] text-[#C9863F]/[0.035] animate-[spin_120s_linear_infinite] motion-reduce:animate-none" />
        <Reveal className="relative max-w-4xl mx-auto text-center">
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

      {/* ─── Acharya Madhav — vehicle-safety-angled variant of the site-wide AI astrologer ── */}
      <AcharyaVahanSection />

      {/* ─── Reviews — real, API-backed customer reviews (same component and endpoint
          as the regular PDP's ReviewsSection), replacing the generic "how it works"
          filler with actual social proof for this exact product. ─────────────────── */}
      <section className="px-5 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          <ReviewsSection productId={product.id} productSlug={product.slug} />
        </div>
      </section>

      {/* ─── FAQ — plain, understated dividers, not a bordered card ──────────── */}
      <section className="px-5 py-12 sm:py-16">
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

      {/* ─── You May Also Need — framed so it reads as a distinct closing gallery,
          not another edge-to-edge rail ────────────────────────────────────────── */}
      <section className="px-5 pb-24 sm:pb-32">
        <div className="relative max-w-6xl mx-auto rounded-[2rem] border border-[#9C5A26]/25 overflow-hidden p-3 sm:p-4">
          {/* Ornamental corner flourishes — a temple-frame motif instead of a plain box
              border, echoing the kundli-chart geometry used elsewhere on this page. */}
          {(['top-3 left-3', 'top-3 right-3 -scale-x-100', 'bottom-3 left-3 -scale-y-100', 'bottom-3 right-3 -scale-x-100 -scale-y-100'] as const).map(
            (pos) => (
              <svg
                key={pos}
                viewBox="0 0 48 48"
                aria-hidden
                className={`pointer-events-none absolute z-10 w-8 h-8 sm:w-10 sm:h-10 text-[#9C5A26]/50 ${pos}`}
              >
                <path d="M2 20 V6 a4 4 0 0 1 4 -4 H20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="2" cy="2" r="2.5" fill="currentColor" />
                <path d="M10 12 a10 10 0 0 1 10 -10" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
              </svg>
            )
          )}

          <div className="rounded-[1.5rem] overflow-hidden">
            <ProductRail eyebrow="More" title="Protection & Blessings" products={relatedProducts} tinted tightTop tightBottom />
          </div>
        </div>
      </section>

      {/* Real site footer — this campaign page skipped the (storefront) layout entirely,
          so it never got the shared Footer; a one-line copyright bar wasn't enough once
          the page grew this much real content, visitors need the actual site links. */}
      <Footer />

      {/* This page sits outside the (storefront) route group, so it doesn't inherit the
          ChatWidget mounted in (storefront)/layout.tsx — without this, both the
          AcharyaVahanSection buttons and any "open-acharya-chat" event on this page fire
          into a void, since nothing is listening for it. */}
      <ChatWidget />
    </div>
  );
}
