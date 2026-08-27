import { HeroCarousel } from '@/components/storefront/HeroCarousel';
import { CashbackStrip } from '@/components/storefront/CashbackStrip';
import { PurposeGrid } from '@/components/storefront/PurposeGrid';
import { TrustBar } from '@/components/storefront/TrustBar';
import { ProductRail } from '@/components/storefront/ProductRail';
import { AcharyaMadhavSection } from '@/components/storefront/AcharyaMadhavSection';
import { TestimonialsCarousel } from '@/components/storefront/TestimonialsCarousel';
import { CategoryStrip, type CategoryThumb } from '@/components/storefront/CategoryStrip';
import { SectionDivider } from '@/components/motion/SectionDivider';
import { api } from '@/lib/api-client';
import type { Product, PaginatedProducts, Banner } from '@/types/api.types';

async function getFeaturedProducts(): Promise<Product[]> {
  try {
    return await api.get<Product[]>('/api/products/featured');
  } catch {
    return []; // Backend down — degrade to an empty section, never a crashed landing page
  }
}

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

export default async function LandingPage() {
  const [featured, doshMuktiSpecial, rudraksha, bracelets, pyrite, attar, dhoop, banners] = await Promise.all([
    getFeaturedProducts(),
    getCategory('Dosh Mukti Special', 10),
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
    { label: 'Dosh Mukti', category: 'Dosh Mukti Special', image: doshMuktiSpecial[0]?.images[0]?.card ?? null },
    { label: 'Pyrite', category: 'Pyrite Items', image: pyrite[0]?.images[0]?.card ?? null },
    { label: 'Attar', category: 'Attar', image: attar[0]?.images[0]?.card ?? null },
    { label: 'Dhoop Sticks', category: 'Dhoop Sticks', image: dhoop[0]?.images[0]?.card ?? null },
  ];

  return (
    <>
      <CategoryStrip items={categoryThumbs} />
      <HeroCarousel banners={banners} />
      <CashbackStrip />
      <PurposeGrid />

      <ProductRail title="Handpicked This Week" products={featured} tightTop tightBottom centered />

      <AcharyaMadhavSection />

      <ProductRail title="Doshmukti Special" products={doshMuktiSpecial} tinted tightTop tightBottom centered />

      <TrustBar />

      <ProductRail title="Rudraksha" products={rudraksha} tightTop tightBottom centered />

      <SectionDivider />

      <ProductRail title="Bracelets" products={bracelets} tinted tightTop tightBottom centered blobVariant="b" />

      <TestimonialsCarousel />
    </>
  );
}
