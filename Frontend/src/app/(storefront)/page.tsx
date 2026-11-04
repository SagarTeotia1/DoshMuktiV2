import { Fragment } from 'react';
import { HeroCarousel } from '@/components/storefront/HeroCarousel';
import { ShopCta } from '@/components/storefront/ShopCta';
import { PurposeGrid } from '@/components/storefront/PurposeGrid';
import { BrandStory } from '@/components/storefront/BrandStory';
import { ProductRail } from '@/components/storefront/ProductRail';
import { MulankRashiSection } from '@/components/storefront/MulankRashiSection';
import { AcharyaMadhavSection } from '@/components/storefront/AcharyaMadhavSection';
import { TestimonialsCarousel } from '@/components/storefront/TestimonialsCarousel';
import { CategoryStrip, firstWord, type CategoryThumb } from '@/components/storefront/CategoryStrip';
import { OrnamentDivider } from '@/components/motion/OrnamentDivider';
import { api } from '@/lib/api-client';
import { getStoryImages } from '@/lib/story-images';
import type { Banner, HomepageSection } from '@/types/api.types';

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

// Admin-managed categories (Admin → Categories): order, visibility and image all come from
// the Backend — image is the uploaded one, else the latest product's.
async function getCategoryThumbs(): Promise<CategoryThumb[]> {
  try {
    const data = await api.get<Array<{ id: string; label: string; stripLabel?: string | null; image: string | null }>>('/api/products/category-thumbs');
    return data.map((c) => ({ label: c.stripLabel || firstWord(c.label), category: c.id, image: c.image }));
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
  const [sections, categoryThumbs, banners, storyImages] = await Promise.all([
    getHomepageSections(),
    getCategoryThumbs(),
    getBanners(),
    getStoryImages(),
  ]);

  return (
    <>
      {/* Homepage had zero <h1> in markup — Google and AEO/GEO extraction lean on this for
          the "what is this page about" anchor. sr-only since the visual hero already
          carries the brand cue; this exists purely for the DOM. */}
      <h1 className="sr-only">Doshmukti — Gemstones & Astrology Remedies for Love, Wealth & Protection</h1>
      <CategoryStrip items={categoryThumbs} />
      <HeroCarousel banners={banners} />
      {/* Straddles the hero's bottom edge so the hero and its button read as one block. */}
      <div className="relative z-10 -mt-6 flex justify-center px-4 pb-2 sm:-mt-7">
        <ShopCta className="border-2 border-[#E6D3AE]" />
      </div>
      {sections[0] && (
        <ProductRail title={sections[0].title} products={sections[0].products} tightTop tightBottom centered />
      )}

      <OrnamentDivider />

      <MulankRashiSection />

      <OrnamentDivider />

      <PurposeGrid />

      <OrnamentDivider />

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

      <BrandStory images={storyImages} />

      {sections[2] && (
        <ProductRail title={sections[2].title} products={sections[2].products} tightTop tightBottom centered />
      )}

      <OrnamentDivider />

      {/* Admin-added rails beyond the original 4 fixed slots above render here,
          alternating tint/blob so consecutive extra rails don't look identical. */}
      {sections.slice(3).map((section, i) => (
        <Fragment key={section.id}>
          {i > 0 && <OrnamentDivider />}
          <ProductRail
            title={section.title}
            products={section.products}
            tinted={i % 2 === 0}
            tightTop
            tightBottom
            centered
            blobVariant={i % 2 === 0 ? 'b' : 'a'}
          />
        </Fragment>
      ))}

      <AcharyaMadhavSection />

      <TestimonialsCarousel />
    </>
  );
}
