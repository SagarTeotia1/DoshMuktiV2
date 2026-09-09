import { HeroCarousel } from '@/components/storefront/HeroCarousel';
import { PurposeGrid } from '@/components/storefront/PurposeGrid';
import { TrustBar } from '@/components/storefront/TrustBar';
import { ProductRail } from '@/components/storefront/ProductRail';
import { AcharyaMadhavSection } from '@/components/storefront/AcharyaMadhavSection';
import { TestimonialsCarousel } from '@/components/storefront/TestimonialsCarousel';
import { CategoryStrip, type CategoryThumb } from '@/components/storefront/CategoryStrip';
import { SectionDivider } from '@/components/motion/SectionDivider';
import { api } from '@/lib/api-client';
import type { Product, PaginatedProducts, Banner, HomepageSection } from '@/types/api.types';

// No searchParams/cookies/headers() here, so this page is fully static — Next prerenders
// it once and serves that same HTML to every visitor everywhere until this window elapses,
// then revalidates in the background (ISR). Matches the 60s the underlying fetches already
// use (api-client's default) — bumping one without the other just means one half of the
// page goes stale before the other on revalidation.
export const revalidate = 60;

async function getBanners(): Promise<Banner[]> {
  try {
    return await api.get<Banner[]>('/api/banners');
  } catch {
    return [];
  }
}

async function getCategory(category: string, limit = 4): Promise<Product[]> {
  try {
    const params = new URLSearchParams({ category, sort: 'newest', limit: String(limit) });
    const data = await api.get<PaginatedProducts>(`/api/products?${params.toString()}`);
    return data.products;
  } catch {
    return [];
  }
}

// Admin-managed, ordered product rails ("Handpicked This Week", "Doshmukti
// Special", "Rudraksha", "Bracelets", and any rail an admin adds later).
async function getHomepageSections(): Promise<HomepageSection[]> {
  try {
    return await api.get<HomepageSection[]>('/api/homepage-sections');
  } catch {
    return []; // Backend down — degrade to no rails, never a crashed landing page
  }
}

export default async function LandingPage() {
  const [sections, doshMuktiSpecial, rudraksha, bracelets, pyrite, attar, dhoop, banners] = await Promise.all([
    getHomepageSections(),
    getCategory('DoshMukti Special', 10),
    getCategory('Rudraksha / Kada', 10),
    getCategory('Bracelets', 10),
    getCategory('Pyrite Items', 1),
    getCategory('Attar', 1),
    getCategory('Dhoop Sticks', 1),
    getBanners(),
  ]);

  const categoryThumbs: CategoryThumb[] = [
    { label: 'Rudraksha', category: 'Rudraksha / Kada', image: rudraksha[0]?.images[0]?.card ?? null },
    { label: 'Bracelets', category: 'Bracelets', image: bracelets[0]?.images[0]?.card ?? null },
    { label: 'DoshMukti', category: 'DoshMukti Special', image: doshMuktiSpecial[0]?.images[0]?.card ?? null },
    { label: 'Pyrite', category: 'Pyrite Items', image: pyrite[0]?.images[0]?.card ?? null },
    { label: 'Attar', category: 'Attar', image: attar[0]?.images[0]?.card ?? null },
    { label: 'Dhoop Sticks', category: 'Dhoop Sticks', image: dhoop[0]?.images[0]?.card ?? null },
  ];

  return (
    <>
      {/* Homepage had zero <h1> in markup — Google and AEO/GEO extraction lean on this for
          the "what is this page about" anchor. sr-only since the visual hero already
          carries the brand cue; this exists purely for the DOM. */}
      <h1 className="sr-only">Doshhmukti — Gemstones & Astrology Remedies for Love, Wealth & Protection</h1>
      <CategoryStrip items={categoryThumbs} />
      <HeroCarousel banners={banners} />
      <PurposeGrid />

      {sections[0] && (
        <ProductRail title={sections[0].title} products={sections[0].products} tightTop tightBottom centered />
      )}

      <AcharyaMadhavSection />

      {sections[1] && (
        <ProductRail
          title={sections[1].title}
          products={sections[1].products}
          tinted
          tightTop
          tightBottom
          centered
        />
      )}

      <TrustBar />

      {sections[2] && (
        <ProductRail title={sections[2].title} products={sections[2].products} tightTop tightBottom centered />
      )}

      <SectionDivider />

      {/* Admin-added rails beyond the original 4 fixed slots above render here,
          alternating tint/blob so consecutive extra rails don't look identical. */}
      {sections.slice(3).map((section, i) => (
        <ProductRail
          key={section.id}
          title={section.title}
          products={section.products}
          tinted={i % 2 === 0}
          tightTop
          tightBottom
          centered
          blobVariant={i % 2 === 0 ? 'b' : 'a'}
        />
      ))}

      {/* Homepage had 669 words of visible text — thin content by SEO crawler standards.
          This section adds real, unique prose (not boilerplate) describing what
          Doshhmukti sells and for whom, carrying the same keywords used in the
          title/meta/H1 so ranking signals reinforce each other across tags. */}
      <section className="bg-[#FBF6EC] py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-heading text-xl sm:text-2xl font-black tracking-tight text-[#2B1B0C] mb-4">
            Authentic Gemstones & Rudraksha, Chosen for Your Chart
          </h2>
          <p className="font-body text-sm sm:text-base text-[#6B5539] leading-relaxed">
            Doshhmukti sells authentic, ritually-energized gemstones, Nepali rudraksha malas and bracelets, sourced
            directly from verified artisans rather than mass-produced imitations. Every product is matched to a
            purpose — love, wealth, health, success, protection or clarity — using Vedic astrology and numerology
            guidance from Acharya Madhav, so you buy the mala or bracelet that actually suits your birth chart
            instead of whatever is trending. The catalog spans 2 to 9 Mukhi Nepali rudraksha, rose quartz and tiger
            eye bracelets, pyrite and citrine pieces for money and career, and dhoop sticks and attar for daily
            pooja. Every order ships pan-India with free shipping above ₹299 and a 7-day return window, and every
            gemstone arrives pre-energized and ready to wear.
          </p>
        </div>
      </section>

      <TestimonialsCarousel />
    </>
  );
}
