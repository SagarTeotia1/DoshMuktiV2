import { cloneElement, type ReactElement } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Gem, Truck, ShieldCheck, RotateCcw, Sparkles, Wallet, Star, Gift } from 'lucide-react';
import { Accordion } from '@/components/storefront/Accordion';
import Image from 'next/image';
import { AddToCart } from './add-to-cart';
import { SidhiTabs } from './sidhi-tabs';
import { HowToUseVideo } from './how-to-use-video';
import { TestimonialVideos } from './testimonial-videos';
import { ProductGallery } from './product-gallery';
import { ReviewsSection } from './reviews-section';
import { RelatedProductsRail } from './related-products-rail';
import { ExclusiveOffers } from '@/components/storefront/ExclusiveOffers';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import type { Product } from '@/types/api.types';

type Offer = Product['offers'][number];

// Reward-specific customer-facing badge text. Falls back to the offer's title
// (admin-internal name) if the config doesn't have what a formatter expects —
// keeps this resilient against data that predates a full backfill.
const OFFER_REWARD_FORMATTERS: Record<Offer['reward'], (offer: Offer) => string> = {
  DISPLAY_MESSAGE: (offer) => (typeof offer.config.bannerText === 'string' && offer.config.bannerText) || offer.title,
  PERCENTAGE_DISCOUNT: (offer) => (typeof offer.config.percent === 'number' ? `${offer.config.percent}% OFF` : offer.title),
  FLAT_DISCOUNT: (offer) => (typeof offer.config.amount === 'number' ? `${formatCurrency(offer.config.amount)} OFF` : offer.title),
  CASHBACK: (offer) => (typeof offer.config.percent === 'number' ? `${offer.config.percent}% Cashback` : offer.title),
  FREE_GIFT: () => 'Free Gift',
  BUY_X_GET_Y: (offer) =>
    typeof offer.config.buyQuantity === 'number' && typeof offer.config.getQuantity === 'number'
      ? `Buy ${offer.config.buyQuantity} Get ${offer.config.getQuantity}`
      : offer.title,
  FREE_SHIPPING: () => 'Free Shipping',
};

function formatOfferBadgeText(offer: Offer): string {
  return (OFFER_REWARD_FORMATTERS[offer.reward] ?? (() => offer.title))(offer);
}

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

const POLICY_SECTIONS = [
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
];

function TrustStrip() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {TRUST_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-[#9C5A26] flex-shrink-0" />
            <span className="font-body text-[11px] font-semibold text-[#6B5539]">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

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
  const activeVariants = product.variants.filter((v) => v.isActive && v.attributes.type !== 'service');
  const price =
    activeVariants.length > 0
      ? Math.min(...activeVariants.map((v) => v.priceOverride ?? product.basePrice))
      : product.basePrice;
  const inStock = activeVariants.some((v) => v.stockQuantity > 0);
  const mrp = product.compareAtPrice && product.compareAtPrice > price ? product.compareAtPrice : null;
  const discountPct = mrp ? Math.round(((mrp - price) / mrp) * 100) : null;

  // Cashback is already shown once via cashbackPercent's own badge — a CASHBACK-reward Offer
  // saying the same thing in a second badge would just contradict it if the numbers differ.
  // COUPON_BASED offers live exclusively in the Exclusive Offers card section below (they need
  // the code + copy button, which doesn't fit this compact badge), so this row only carries
  // AUTO_APPLIED (applies with no action needed) and DISPLAY_ONLY (pure marketing tag) —
  // keeping every offer in exactly one place on the page.
  const displayOffers = product.offers.filter((o) => o.reward !== 'CASHBACK' && o.behavior !== 'COUPON_BASED');

  type DetailSection = { title: string; content: React.ReactNode };
  const rawDetailSections: Array<DetailSection | false | '' | null> = [
    product.benefits.length > 0 && {
      title: 'Benefits',
      content: (
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
      ),
    },
    product.howToWear.length > 0 && {
      title: 'How to Wear & Recharge',
      content: (
        <ol className="flex flex-col gap-2.5">
          {product.howToWear.map((step, i) => (
            <li key={i} className="flex gap-3 font-body text-xs text-[#6B5539] leading-relaxed">
              <span className="font-heading font-black text-[#9C5A26] flex-shrink-0">{i + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
      ),
    },
    product.careInstructions && {
      title: 'Care Instructions',
      content: <p className="font-body text-xs text-[#8A7A63] leading-relaxed whitespace-pre-line">{product.careInstructions}</p>,
    },
  ];
  const detailSections = rawDetailSections.filter((s): s is DetailSection => !!s);

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
        <div className="flex flex-col gap-6">
          <ProductGallery images={product.images} name={product.name} badge={product.badge} inStock={inStock} />

          {/* Policy accordion — desktop only, sits directly under the gallery.
              Mobile keeps its own copy further down, in the details column. */}
          <div className="hidden lg:block border-t border-[#2B1B0C]/10 pt-2">
            <Accordion sections={POLICY_SECTIONS} />
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <h1 className="font-heading font-black tracking-tight leading-[1.1] text-2xl sm:text-3xl text-[#2B1B0C] mb-3">
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

          {/* Purpose + storefront tags — one merged row, not two separate look-alike groups */}
          {(product.purpose.length > 0 || product.tags.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {product.purpose.map((p) => (
                <Link
                  key={p}
                  href={`/shop?purpose=${p}`}
                  className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 border border-[#2B1B0C]/20 text-[#6B5539] font-body rounded-full hover:border-[#9C5A26] hover:text-[#9C5A26] transition-colors"
                >
                  {PURPOSE_LABELS[p] ?? p}
                </Link>
              ))}
              {product.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 bg-[#9C5A26]/10 text-[#6B3D19] font-body rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Price — the single largest figure on the page, outranks the headline */}
          <div className="flex items-baseline gap-2.5 mb-3">
            <p className="font-heading text-3xl sm:text-4xl font-black text-[#2B1B0C] tabular-nums">{formatCurrency(price)}</p>
            {mrp && (
              <>
                <p className="font-body text-base text-[#8A7A63] line-through">{formatCurrency(mrp)}</p>
                <span className="font-body text-sm font-bold text-[#B23A2E]">{discountPct}% off</span>
              </>
            )}
          </div>

          {/* Offer badges — every offer rendered the same way, wrapping to as many rows as needed.
              Cashback % (if set) takes the first slot. An odd badge out spans the full row
              instead of leaving an empty half-slot next to it. */}
          {(() => {
            const cashbackBadge = !!product.cashbackPercent ? (
              <div key="cashback" className="brutal-border flex items-center gap-2 bg-[#2B1B0C] text-[#FBF1DF] rounded-lg px-3 py-3 shadow-[2px_2px_0_0_#9C5A26]">
                <Wallet className="w-4 h-4 text-[#C9863F] flex-shrink-0" />
                <div className="leading-tight">
                  <p className="font-heading font-black text-[11px] uppercase tracking-wide">{product.cashbackPercent}% Cashback</p>
                  <p className="font-body text-[10px] text-[#C9863F]">on first order</p>
                </div>
              </div>
            ) : null;
            const badges: ReactElement<{ className: string }>[] = [
              cashbackBadge,
              ...displayOffers.map((offer) => (
                <div key={offer.id} className="brutal-border flex items-center gap-2 bg-[#2B1B0C] text-[#FBF1DF] rounded-lg px-3 py-3 shadow-[2px_2px_0_0_#9C5A26]">
                  <Gift className="w-4 h-4 text-[#C9863F] flex-shrink-0" />
                  <p className="font-heading font-black text-[11px] uppercase tracking-wide leading-tight">{formatOfferBadgeText(offer)}</p>
                </div>
              )),
            ].filter((b): b is ReactElement<{ className: string }> => b !== null);
            const isLastOdd = badges.length % 2 === 1;

            return (
              badges.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {badges.map((badge, i) =>
                    isLastOdd && i === badges.length - 1
                      ? cloneElement(badge, {
                          className: `${badge.props.className} col-span-2 justify-center`,
                        })
                      : badge
                  )}
                </div>
              )
            );
          })()}

          {/* Sidhi / Energize */}
          <SidhiTabs product={product} />

          {/* The one decisive action */}
          <div className="border-t border-[#2B1B0C]/10 pt-6 mb-6">
            <AddToCart product={product} />
          </div>

          {/* Trust signals sit right after the CTA — reassurance belongs next to the decision, not in another column */}
          <div className="mb-6">
            <TrustStrip />
          </div>

          {/* Exclusive offers — its own card section, distinct from the compact badge row above the CTA */}
          <ExclusiveOffers offers={product.offers} />

          {product.socialProofText && (
            <p className="font-body text-xs text-[#9C5A26] font-semibold mb-5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {product.socialProofText}
            </p>
          )}

          {/* Optional-chained: backend may not have deployed this field yet on a given
              environment (stale server, migration not run) — never crash the whole PDP over it. */}
          {(product.testimonialVideos ?? []).length > 0 && (
            <TestimonialVideos videos={product.testimonialVideos ?? []} product={product} price={price} />
          )}

          {/* Description — the only "read more" section left open by default. Renders the
              admin-composed, fully-ordered block array (text/image, any mix/count, in the
              order the admin arranged them) rather than a fixed text-then-gallery layout. */}
          {(product.description ?? []).length > 0 && (
            <div className="border-t border-[#2B1B0C]/10 pt-6 mb-2 flex flex-col gap-4">
              {(product.description ?? []).map((block, i) =>
                block.type === 'text' ? (
                  <p key={i} className="font-body text-sm text-[#6B5539] leading-relaxed whitespace-pre-line">
                    {block.content}
                  </p>
                ) : (
                  // Full image, no forced 16:9 crop — a fixed aspect-video box with
                  // object-cover was cutting off portrait/tall images. Plain <img>, not
                  // next/image, so an arbitrary uploaded aspect ratio (portrait, square,
                  // landscape) always renders at its real proportions instead of being
                  // squeezed into a guessed width/height box.
                  <div key={i} className="w-full rounded-lg overflow-hidden border border-[#2B1B0C]/15">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={block.full} alt="" className="w-full h-auto block" />
                  </div>
                )
              )}
            </div>
          )}

          {/* How to Use — always open, not tucked into the accordion */}
          <HowToUseVideo url={product.howToUseVideoUrl} />

          {/* Everything else worth reading, but only if you go looking for it */}
          {detailSections.length > 0 && (
            <div className="border-t border-[#2B1B0C]/10 pt-2 mb-2 sm:mb-6">
              <Accordion sections={detailSections} />
            </div>
          )}

          {/* Policy accordion — mobile only, desktop copy sits under the gallery instead.
              No extra border-t here: the accordion above already closes with its own border-b. */}
          <div className="lg:hidden">
            <Accordion sections={POLICY_SECTIONS} />
          </div>
        </div>
      </div>

      <ReviewsSection productId={product.id} productSlug={product.slug} />

      {related.length > 0 && <RelatedProductsRail products={related} />}
    </div>
  );
}
