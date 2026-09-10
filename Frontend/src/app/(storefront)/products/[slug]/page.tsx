import { cloneElement, type ReactElement } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Gem, Truck, ShieldCheck, RotateCcw, Ban, Sparkles, Star, Gift } from 'lucide-react';
import { Accordion } from '@/components/storefront/Accordion';
import Image from 'next/image';
import { AddToCart } from './add-to-cart';
import { SidhiTabs } from './sidhi-tabs';
import { HowToUseVideo } from './how-to-use-video';
import { TestimonialVideos } from './testimonial-videos';
import { ProductGallery } from './product-gallery';
import { DescriptionCarousel } from './description-carousel';
import { ReviewsSection } from './reviews-section';
import { RelatedProductsRail } from './related-products-rail';
import { ExclusiveOffers } from '@/components/storefront/ExclusiveOffers';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import { SITE_URL, RETURN_ELIGIBLE_ABOVE, FREE_SHIPPING_ABOVE, CAMPAIGN_PAGE_SLUGS } from '@/lib/constants';
import type { Product, ProductReviewsResponse } from '@/types/api.types';

// No searchParams/cookies/headers() on this route, so with the ISR pieces below, each
// product page is cached per-slug (not just its data) and reused for every visitor,
// anywhere, until this window elapses, then revalidated in the background.
export const revalidate = 60;

// This is what actually switches [slug] from per-request SSR to a cached ISR page —
// `revalidate` alone does nothing on a dynamic segment without it. Returning [] here (not
// pre-fetching real slugs) keeps the Docker build from depending on the Backend being
// reachable at build time; `dynamicParams` defaults to true, so the first request for any
// slug renders once and is cached from then on, same end result without the build risk.
export async function generateStaticParams() {
  return [];
}

type Offer = Product['offers'][number];

// Reward-specific customer-facing badge text. Falls back to the offer's title
// (admin-internal name) if the config doesn't have what a formatter expects —
// keeps this resilient against data that predates a full backfill.
const OFFER_REWARD_FORMATTERS: Record<Offer['reward'], (offer: Offer) => string> = {
  DISPLAY_MESSAGE: (offer) => (typeof offer.config.bannerText === 'string' && offer.config.bannerText) || offer.title,
  PERCENTAGE_DISCOUNT: (offer) => (typeof offer.config.percent === 'number' ? `${offer.config.percent}% OFF` : offer.title),
  FLAT_DISCOUNT: (offer) => (typeof offer.config.amount === 'number' ? `${formatCurrency(offer.config.amount)} OFF` : offer.title),
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

// Items priced below RETURN_ELIGIBLE_ABOVE aren't worth a reverse pickup — see
// Terms & Conditions § 9. Both the trust strip and the policy accordion below
// need to know this, so it's computed once per product in the page component
// and threaded through rather than hardcoded per-list.
function getTrustItems(eligibleForReturn: boolean) {
  return [
    { icon: Gem, label: 'Authentic & Energized' },
    { icon: Truck, label: `Free Shipping ₹${FREE_SHIPPING_ABOVE}+` },
    { icon: ShieldCheck, label: 'Secure Payments' },
    eligibleForReturn ? { icon: RotateCcw, label: '7-Day Returns' } : { icon: Ban, label: 'Non-Returnable' },
  ];
}

function getPolicySections(eligibleForReturn: boolean) {
  return [
    {
      title: 'Delivery & Shipping',
      content: 'Orders are dispatched within 24-48 hours and typically arrive within 5-7 business days across India.',
    },
    {
      title: 'Returns & Replacement',
      content: eligibleForReturn
        ? `Damaged or incorrect items can be reported within 48 hours of delivery for a free replacement. This item also qualifies for a 7-day change-of-mind return from the date of delivery.`
        : `Damaged or incorrect items can be reported within 48 hours of delivery for a free replacement. Items priced below ₹${RETURN_ELIGIBLE_ABOVE} are final sale and not eligible for a change-of-mind return.`,
    },
    {
      title: 'Need Help?',
      content: 'Chat with us Mon to Sat, 10 AM to 5 PM, via the support widget or WhatsApp.',
    },
  ];
}

// Consecutive 'image' blocks in the admin-composed description render as one carousel
// instead of one full-width image per block — so an admin dropping in 4 photos back to
// back gets a swipeable set, not a long vertical scroll of images.
type DescriptionGroup =
  | { type: 'text'; content: string }
  | { type: 'images'; images: { full: string }[] };

function groupDescriptionBlocks(blocks: Product['description']): DescriptionGroup[] {
  const groups: DescriptionGroup[] = [];
  for (const block of blocks) {
    if (block.type === 'text') {
      groups.push({ type: 'text', content: block.content });
    } else {
      const last = groups[groups.length - 1];
      if (last?.type === 'images') last.images.push({ full: block.full });
      else groups.push({ type: 'images', images: [{ full: block.full }] });
    }
  }
  return groups;
}

function TrustStrip({ eligibleForReturn }: { eligibleForReturn: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {getTrustItems(eligibleForReturn).map((item) => {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) return {};

  const { product } = data;
  const purposeText = product.purpose.map((p) => PURPOSE_LABELS[p] ?? p).join(', ');
  const title = purposeText ? `${product.name} — For ${purposeText}` : product.name;
  const primaryCategory = product.categories[0] ?? '';
  const description =
    product.excerpt ||
    `${product.name} — authentic, ritually energized ${primaryCategory.toLowerCase()}${purposeText ? ` for ${purposeText.toLowerCase()}` : ''}. Vedic astrology guidance included. Free shipping over ₹${FREE_SHIPPING_ABOVE}.`;
  const canonical = CAMPAIGN_PAGE_SLUGS[product.slug] ?? `/products/${product.slug}`;
  const image = product.images[0]?.card;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${canonical}`,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProduct(slug);
  if (!data) notFound();

  const { product, related } = data;

  // Fetched here too (ReviewsSection client-fetches the same endpoint for the interactive
  // list) purely so real review text lands in the server-rendered JSON-LD below — a
  // crawler reading only the initial HTML (common for Googlebot's first pass) sees actual
  // customer review content and ratings, not just the aggregate number. Same 60s ISR
  // cache as the product fetch, so this costs nothing extra per-visitor.
  const reviewsData = await api
    .get<ProductReviewsResponse>(`/api/products/${slug}/reviews`, undefined, revalidate)
    .catch(() => null);
  const activeVariants = product.variants.filter((v) => v.isActive && v.attributes.type !== 'service');
  const price =
    activeVariants.length > 0
      ? Math.min(...activeVariants.map((v) => v.priceOverride ?? product.basePrice))
      : product.basePrice;
  const inStock = activeVariants.some((v) => v.stockQuantity > 0);
  const mrp = product.compareAtPrice && product.compareAtPrice > price ? product.compareAtPrice : null;
  const discountPct = mrp ? Math.round(((mrp - price) / mrp) * 100) : null;
  const eligibleForReturn = price >= RETURN_ELIGIBLE_ABOVE;
  const policySections = getPolicySections(eligibleForReturn);

  // COUPON_BASED offers live exclusively in the Exclusive Offers card section below (they need
  // the code + copy button, which doesn't fit this compact badge), so this row only carries
  // AUTO_APPLIED (applies with no action needed) and DISPLAY_ONLY (pure marketing tag) —
  // keeping every offer in exactly one place on the page.
  const displayOffers = product.offers.filter((o) => o.behavior !== 'COUPON_BASED');

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

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.excerpt || product.name,
    image: product.images.map((img) => img.full),
    sku: product.variants[0]?.sku,
    brand: { '@type': 'Brand', name: 'Doshhmukti' },
    aggregateRating:
      product.rating.count > 0
        ? { '@type': 'AggregateRating', ratingValue: product.rating.average, reviewCount: product.rating.count }
        : undefined,
    review: reviewsData?.reviews.length
      ? reviewsData.reviews.map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.customerName },
          datePublished: r.createdAt,
          reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          ...(r.title ? { name: r.title } : {}),
          reviewBody: r.body,
        }))
      : undefined,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}${CAMPAIGN_PAGE_SLUGS[product.slug] ?? `/products/${product.slug}`}`,
      priceCurrency: 'INR',
      price,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE_URL}/shop` },
      { '@type': 'ListItem', position: 3, name: product.name, item: `${SITE_URL}/products/${product.slug}` },
    ],
  };

  // AEO target: "how to wear a [product]" is a real query pattern, and this content
  // already exists as a real numbered list on the page — just missing the markup
  // that tells Google/AI extractors it's a HowTo, not prose.
  const howToJsonLd =
    product.howToWear.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: `How to Wear & Recharge ${product.name}`,
          step: product.howToWear.map((step, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            text: step,
          })),
        }
      : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {howToJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      )}
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 font-body text-[11px] text-[#8A7A63] mb-6 sm:mb-8">
        <Link href="/" className="hover:text-[#9C5A26] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-[#9C5A26] transition-colors">Shop</Link>
        <span>/</span>
        <span className="text-[#2B1B0C] font-semibold truncate max-w-[160px] sm:max-w-none">{product.name}</span>
      </nav>

      {/* No items-start on the grid (default stretch) — the outer left cell's own box ends up
          exactly as tall as the details column next to it. That's the opposite of what you'd
          want on the STICKY element itself (a sticky box exactly as tall as its container has
          zero room to stay pinned — it releases immediately), so sticky lives on the INNER
          wrapper instead, which keeps its natural short height (gallery + accordion) and pins
          within the tall outer box for the full scroll, releasing only when that box ends. */}
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
        {/* min-w-0 — without it, a grid item's default min-width is content-based, so the
            thumbnail row's intrinsic width (many thumbnails × ~74px can exceed a phone's
            viewport) forces this whole column, and with it the entire page, to overflow
            horizontally instead of letting the row's own overflow-x-auto scroll it. */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-24 flex flex-col gap-6">
            <ProductGallery images={product.images} name={product.name} badge={product.badge} inStock={inStock} />

            {/* Policy accordion — desktop only, sits directly under the gallery.
                Mobile keeps its own copy further down, in the details column. */}
            <div className="hidden lg:block border-t border-[#2B1B0C]/10 pt-2">
              <Accordion sections={policySections} />
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="flex flex-col min-w-0">
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
              An odd badge out spans the full row instead of leaving an empty half-slot next to it. */}
          {(() => {
            const badges: ReactElement<{ className: string }>[] = displayOffers.map((offer) => (
              <div key={offer.id} className="brutal-border flex items-center gap-2 bg-[#2B1B0C] text-[#E6D3AE] rounded-lg px-3 py-3 shadow-[2px_2px_0_0_#9C5A26]">
                <Gift className="w-4 h-4 text-[#C9863F] flex-shrink-0" />
                <p className="font-heading font-black text-[11px] uppercase tracking-wide leading-tight">{formatOfferBadgeText(offer)}</p>
              </div>
            ));
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
            <TrustStrip eligibleForReturn={eligibleForReturn} />
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

          {/* How to Use — always open, not tucked into the accordion. Sits above the
              description block below: video first (how it's worn), then the photo/text
              gallery (what it looks like) — video is the higher-intent content here. */}
          <HowToUseVideo url={product.howToUseVideoUrl} />

          {/* Description — the only "read more" section left open by default. Renders the
              admin-composed, fully-ordered block array (text/image, any mix/count, in the
              order the admin arranged them) rather than a fixed text-then-gallery layout.
              Array.isArray guard, not just `?? []` — a Prisma Json column has no runtime
              shape guarantee, so a non-array value here must not crash the whole PDP. */}
          {Array.isArray(product.description) && product.description.length > 0 && (
            <div className="border-t border-[#2B1B0C]/10 pt-6 mb-2 flex flex-col gap-5">
              {groupDescriptionBlocks(product.description).map((group, i) =>
                group.type === 'text' ? (
                  <p key={i} className="font-body text-sm text-[#6B5539] leading-relaxed whitespace-pre-line">
                    {group.content}
                  </p>
                ) : (
                  // No forced 16:9 crop — a fixed aspect-video box with object-cover was
                  // cutting off portrait/tall images. Natural aspect ratio, swiped as a
                  // carousel when the admin dropped in more than one image back to back.
                  <DescriptionCarousel key={i} images={group.images} name={product.name} />
                )
              )}
            </div>
          )}

          {/* Everything else worth reading, but only if you go looking for it */}
          {detailSections.length > 0 && (
            <div className="border-t border-[#2B1B0C]/10 pt-2 mb-2 sm:mb-6">
              <Accordion sections={detailSections} />
            </div>
          )}

          {/* Policy accordion — mobile only, desktop copy sits under the gallery instead.
              No extra border-t here: the accordion above already closes with its own border-b. */}
          <div className="lg:hidden">
            <Accordion sections={policySections} />
          </div>
        </div>
      </div>

      <ReviewsSection productId={product.id} productSlug={product.slug} initialData={reviewsData ?? undefined} />

      {related.length > 0 && <RelatedProductsRail products={related} />}
    </div>
  );
}
