import { SITE_URL } from '@/lib/constants';
import type { Product, ProductReviewsResponse } from '@/types/api.types';

export interface GenerateProductJsonLdOptions {
  product: Product;
  reviewsData?: ProductReviewsResponse | null;
  canonicalPath?: string;
  variantPrice?: number;
  inStock?: boolean;
  heroImage?: string | null;
  fullDescription?: string;
}

/**
 * Builds Schema.org Product structured data compliant with Google Search Console Rich Results requirements.
 * Includes aggregateRating and review arrays whenever reviews or ratings exist.
 */
export function generateProductJsonLd({
  product,
  reviewsData,
  canonicalPath,
  variantPrice,
  inStock,
  heroImage,
  fullDescription,
}: GenerateProductJsonLdOptions) {
  const activeVariants = product.variants?.filter((v) => v.isActive && v.attributes.type !== 'service') ?? [];
  const primaryVariant = activeVariants[0] ?? product.variants?.[0];

  const price =
    variantPrice !== undefined
      ? variantPrice
      : activeVariants.length > 0
      ? Math.min(...activeVariants.map((v) => Number(v.priceOverride ?? product.basePrice)))
      : Number(product.basePrice);

  const isAvailable = inStock !== undefined ? inStock : activeVariants.some((v) => v.stockQuantity > 0);

  const images: string[] = [];
  if (heroImage) {
    images.push(heroImage);
  }
  if (product.images?.length) {
    for (const img of product.images) {
      const url = img.full || img.card;
      if (url && !images.includes(url)) {
        images.push(url);
      }
    }
  }

  const reviewCount =
    (product.rating?.count ?? 0) > 0
      ? product.rating.count
      : (reviewsData?.totalReviews ?? reviewsData?.reviews?.length ?? 0);

  const rawRatingValue =
    (product.rating?.count ?? 0) > 0
      ? product.rating.average
      : (reviewsData?.averageRating ?? 5);

  const rawUrl = canonicalPath || `/products/${product.slug}`;
  const url = rawUrl.startsWith('http') ? rawUrl : `${SITE_URL}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.excerpt || fullDescription || product.name,
    ...(images.length > 0 ? { image: images } : {}),
    ...(primaryVariant?.sku ? { sku: primaryVariant.sku } : {}),
    brand: {
      '@type': 'Brand',
      name: 'Doshhmukti',
    },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: Number(price),
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
      itemCondition: 'https://schema.org/NewCondition',
      availability: isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  if (reviewCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(Number(rawRatingValue).toFixed(1)),
      reviewCount: reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (reviewsData?.reviews && reviewsData.reviews.length > 0) {
    jsonLd.review = reviewsData.reviews.map((r) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: r.customerName || 'Verified Customer',
      },
      datePublished: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : undefined,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      ...(r.title ? { name: r.title } : {}),
      reviewBody: r.body,
    }));
  }

  return jsonLd;
}
