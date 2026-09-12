import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/providers/query-provider';
import { FirebaseProvider } from '@/providers/firebase-provider';
import { FacebookPixelProvider } from '@/providers/facebook-pixel-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { DeferredFontStylesheet } from '@/components/layout/deferred-font-stylesheet';
import { SITE_URL, SOCIAL_LINKS } from '@/lib/constants';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-outfit',
  display: 'swap',
});

// Title kept in the 50-60 char sweet spot and description under ~160 — both were
// previously 86/247 chars (truncated mid-sentence) then over-corrected to 43 chars
// (too short to carry secondary keywords) in the Google SERP.
const TITLE_DEFAULT = 'Doshhmukti — Astrology Products & Remedies';
const DESCRIPTION =
  'Authentic astrology products — energized gemstones, rudraksha malas and bracelets — chosen with Vedic guidance. Shop remedies for love, wealth, health & protection.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE_DEFAULT, template: '%s — Doshhmukti' },
  description: DESCRIPTION,
  keywords: [
    'gemstones for wealth',
    'gemstones for love',
    'astrology remedies',
    'how to increase wealth astrology',
    'rudraksha mala',
    'energized bracelet',
    'vastu products',
    'pooja accessories',
    'vedic astrology jewellery',
    'numerology remedies',
    // Hinglish — matches how most Indian users actually type these searches
    'rashi ratna online',
    'graha dosh nivaran upay',
    'vastu dosh ke upay',
    'rudraksha mala online',
    'energized bracelet for money',
    'pooja samagri online',
    'jyotish ratna',
    'shani dosh nivaran',
    // Hindi (Devanagari)
    'रत्न ज्योतिष',
    'ग्रह दोष निवारण',
    'वास्तु दोष उपाय',
    'रुद्राक्ष माला',
    'पूजा सामग्री',
    'रत्न धन के लिए',
  ],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    siteName: 'Doshhmukti',
    title: TITLE_DEFAULT,
    description: DESCRIPTION,
    type: 'website',
    locale: 'en_IN',
    url: SITE_URL,
  },
  twitter: { card: 'summary_large_image', title: TITLE_DEFAULT, description: DESCRIPTION },
};

// Without this, mobile browsers render at a default ~980px desktop-width viewport and
// scale the whole page down to fit the screen — every page looks "zoomed out" with dark
// letterboxing on the sides instead of laying out responsively edge-to-edge.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E6D3AE',
};

const businessAddress = {
  '@type': 'PostalAddress',
  streetAddress: 'Rohini Sector 11',
  addressLocality: 'New Delhi',
  addressRegion: 'Delhi',
  addressCountry: 'IN',
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Doshhmukti',
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  alternateName: 'Dosh Mukti',
  description:
    'Doshhmukti (dosh mukti — freedom from planetary doshas) sells authentic, ritually-energized gemstones, rudraksha malas and pooja accessories, chosen for the customer using Vedic astrology and numerology, for goals spanning love, wealth, health, success, protection and clarity.',
  telephone: '+91-88823-86868',
  address: businessAddress,
  sameAs: [SOCIAL_LINKS.instagram, SOCIAL_LINKS.youtube],
};

// Satisfies the "Local Business Schema" SEO check — separate from Organization
// above since crawlers look for the LocalBusiness type specifically.
const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Doshhmukti',
  url: SITE_URL,
  telephone: '+91-88823-86868',
  address: businessAddress,
  image: `${SITE_URL}/icon`,
  priceRange: '₹₹',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Doshhmukti',
  alternateName: 'Dosh Mukti',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/shop?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={outfit.variable}>
      <head>
        {/* Discovered and fetched in parallel with the document, instead of chained
            behind globals.css's old @import (see globals.css comment). Actual
            stylesheet is loaded non-blocking via DeferredFontStylesheet below —
            Satoshi has font-display: swap upstream, so text isn't invisible while
            it loads, just rendered in the fallback font briefly. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <DeferredFontStylesheet />
        <noscript>
          <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" />
        </noscript>
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }} />
        <QueryProvider>
          <AuthProvider>
            <FirebaseProvider />
            <FacebookPixelProvider />
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
