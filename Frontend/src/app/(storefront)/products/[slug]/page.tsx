import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Gem, Truck, ShieldCheck, RotateCcw, Sparkles, Wallet, Star } from 'lucide-react';
import { ProductCard } from '@/components/storefront/ProductCard';
import { Accordion } from '@/components/storefront/Accordion';
import { AddToCart } from './add-to-cart';
import { ProductGallery } from './product-gallery';
import { ReviewsSection } from './reviews-section';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types/api.types';

interface ProductDetailResponse {
  product: Product;
  related: Product[];
}

const PURPOSE_LABELS: Record<string, string> = {
  love: 'Love',
  wealth: 'Wealth',
  health: 'Health',
  success: 'Success',
  protection: 'Protection',
  clarity: 'Clarity',
  gifting: 'Gifting',
};

const TRUST_ITEMS = [
  { icon: Gem, label: 'Authentic & Energized' },
  { icon: Truck, label: 'Free Shipping ₹999+' },
  { icon: ShieldCheck, label: 'Secure Payments' },
  { icon: RotateCcw, label: '7-Day Returns' },
];

async function getProduct(slug: string): Promise<ProductDetailResponse | null> {
  try {
    return await api.get<ProductDetailResponse>(`/api/products/${slug}`);
  } catch {
    return null;
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) notFound();

  const { product, related } = data;
  const activeVariants = product.variants.filter((v) => v.isActive);
  const price =
    activeVariants.length > 0
      ? Math.min(...activeVariants.map((v) => v.priceOverride ?? product.basePrice))
      : product.basePrice;
  const inStock = activeVariants.some((v) => v.stockQuantity > 0);
  const mrp = product.compareAtPrice && product.compareAtPrice > price ? product.compareAtPrice : null;
  const discountPct = mrp ? Math.round(((mrp - price) / mrp) * 100) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-[11px] text-[#8A7A63] mb-6 sm:mb-8">
        <Link href="/" className="hover:text-[#9C5A26] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-[#9C5A26] transition-colors">Shop</Link>
        <span>/</span>
        <span className="text-[#2B1B0C] font-semibold truncate max-w-[160px] sm:max-w-none">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
        <ProductGallery images={product.images} name={product.name} badge={product.badge} inStock={inStock} />

        {/* Details */}
        <div className="flex flex-col">
          <span className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#9C5A26] mb-2">
            {product.category}
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[#2B1B0C] leading-[1.05] mb-2">
            {product.name}
          </h1>

          {product.rating.count > 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < Math.round(product.rating.average) ? 'fill-[#9C5A26] text-[#9C5A26]' : 'text-[#2B1B0C]/15'}`}
                  />
                ))}
              </div>
              <span className="font-body text-xs text-[#8A7A63]">
                {product.rating.average.toFixed(1)} ({product.rating.count} review{product.rating.count === 1 ? '' : 's'})
              </span>
            </div>
          )}

          {product.purpose.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {product.purpose.map((p) => (
                <Link
                  key={p}
                  href={`/shop?purpose=${p}`}
                  className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border border-[#2B1B0C]/20 text-[#6B5539] font-body rounded-full hover:border-[#9C5A26] hover:text-[#9C5A26] transition-colors"
                >
                  {PURPOSE_LABELS[p] ?? p}
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2.5 mb-1">
            <p className="font-heading text-2xl sm:text-3xl font-bold text-[#2B1B0C]">{formatCurrency(price)}</p>
            {mrp && (
              <>
                <p className="font-body text-sm sm:text-base text-[#8A7A63] line-through">{formatCurrency(mrp)}</p>
                <span className="font-body text-xs font-bold text-[#B23A2E]">{discountPct}% off</span>
              </>
            )}
          </div>

          {!!product.cashbackPercent && (
            <p className="font-body text-xs font-bold text-[#9C5A26] mb-2 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              {product.cashbackPercent}% Cashback in Wallet on this order
            </p>
          )}

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {product.tags.map((tag) => (
                <span key={tag} className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-[#9C5A26]/10 text-[#6B3D19] font-body rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {product.socialProofText ? (
            <p className="font-body text-xs text-[#9C5A26] font-semibold mb-5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {product.socialProofText}
            </p>
          ) : (
            <div className="mb-5" />
          )}

          <p className="font-body text-sm text-[#6B5539] leading-relaxed whitespace-pre-line mb-6">
            {product.description}
          </p>

          <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6">
            <AddToCart product={product} />
          </div>

          {product.benefits.length > 0 && (
            <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6">
              <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-4">Benefits</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {product.benefits.map((b, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full border border-[#2B1B0C] bg-white flex items-center justify-center mt-0.5">
                      <span className="font-heading font-black text-[10px] text-[#9C5A26]">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <div>
                      <p className="font-heading font-bold text-xs text-[#2B1B0C] mb-0.5">{b.title}</p>
                      <p className="font-body text-xs text-[#8A7A63] leading-relaxed">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.howToWear.length > 0 && (
            <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6">
              <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-4">How to Wear</h2>
              <ol className="flex flex-col gap-2.5">
                {product.howToWear.map((step, i) => (
                  <li key={i} className="flex gap-3 font-body text-xs text-[#6B5539] leading-relaxed">
                    <span className="font-heading font-black text-[#9C5A26] flex-shrink-0">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {product.careInstructions && (
            <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6">
              <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-3">Care Instructions</h2>
              <p className="font-body text-xs text-[#8A7A63] leading-relaxed whitespace-pre-line">{product.careInstructions}</p>
            </div>
          )}

          {/* Trust strip */}
          <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6 grid grid-cols-2 gap-3">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-[#9C5A26] flex-shrink-0" />
                  <span className="font-body text-[10px] sm:text-[11px] font-semibold text-[#6B5539]">{item.label}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-[#2B1B0C]/10 pt-2">
            <Accordion
              sections={[
                {
                  title: 'Delivery & Shipping',
                  content: 'Orders are dispatched within 24-48 hours and typically arrive within 5-7 business days across India.',
                },
                {
                  title: 'Returns & Replacement',
                  content: 'Damaged or incorrect items can be reported within 48 hours of delivery for a free replacement.',
                },
                {
                  title: 'Cashback Policy',
                  content: 'Cashback, where applicable, is credited to your account within 7 days of order delivery.',
                },
                {
                  title: 'Need Help?',
                  content: 'Chat with us Mon to Sat, 10 AM to 5 PM, via the support widget or WhatsApp.',
                },
              ]}
            />
          </div>
        </div>
      </div>

      <ReviewsSection productId={product.id} productSlug={product.slug} />

      {related.length > 0 && (
        <section className="mt-16 sm:mt-24">
          <div className="mb-6 sm:mb-8">
            <p className="font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-[#9C5A26] mb-2">
              You May Also Like
            </p>
            <h2 className="font-heading text-2xl sm:text-3xl font-black tracking-tighter uppercase text-[#2B1B0C]">
              Complete The Ritual
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
