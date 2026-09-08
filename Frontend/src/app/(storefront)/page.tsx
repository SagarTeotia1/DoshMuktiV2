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

      <TestimonialsCarousel />
    </>
  );
}
