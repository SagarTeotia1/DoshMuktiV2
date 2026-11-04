import { SITE_URL, SHIPPING_FEE, FREE_SHIPPING_ABOVE, RETURN_ELIGIBLE_ABOVE } from '@/lib/constants';
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
 * Shipping + return policy blocks, shared by every Offer and the Organization schema so Google's
 * Merchant listings report never sees an Offer without them. Mirrors the real storefront policy:
 * flat SHIPPING_FEE below FREE_SHIPPING_ABOVE, 7-day returns on orders at/above RETURN_ELIGIBLE_ABOVE.
 */
export function buildShippingDetails(price: number) {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: price >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FEE,
      currency: 'INR',
    },
    shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 5, maxValue: 7, unitCode: 'DAY' },
    },
  };
}

export function buildReturnPolicy(price: number) {
  if (price >= RETURN_ELIGIBLE_ABOVE) {
    return {
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'IN',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 7,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/ReturnShippingFees',
      refundType: 'https://schema.org/FullRefund',
      merchantReturnLink: `${SITE_URL}/terms`,
    };
  }
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'IN',
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    merchantReturnLink: `${SITE_URL}/terms`,
  };
}

/** Store-wide return policy for the Organization schema (applies when an Offer doesn't carry its own). */
export function buildOrganizationReturnPolicy() {
  return buildReturnPolicy(RETURN_ELIGIBLE_ABOVE);
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
    url,
    brand: {
      '@type': 'Brand',
      name: 'Doshmukti',
    },
    ...(product.categories?.[0] ? { category: product.categories[0] } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'INR',
      price: Number(price),
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
      itemCondition: 'https://schema.org/NewCondition',
      availability: isAvailable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      shippingDetails: buildShippingDetails(Number(price)),
      hasMerchantReturnPolicy: buildReturnPolicy(Number(price)),
      seller: { '@type': 'Organization', name: 'Doshmukti', url: SITE_URL },
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
