import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/providers/query-provider';
import { FirebaseProvider } from '@/providers/firebase-provider';
import { SITE_URL, SOCIAL_LINKS } from '@/lib/constants';

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-outfit',
  display: 'swap',
});

const TITLE_DEFAULT = 'Doshhmukti — Sacred Products for Every Intention';
const DESCRIPTION =
  'Authentic rings, bracelets, crystals and pooja accessories — each curated for love, wealth, health, success, protection and clarity.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE_DEFAULT, template: '%s — Doshhmukti' },
  description: DESCRIPTION,
  keywords: ['spiritual products', 'vastu', 'pooja', 'crystal', 'bracelet', 'ring', 'lucky charm'],
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

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Doshhmukti',
  url: SITE_URL,
  logo: `${SITE_URL}/icon`,
  sameAs: [SOCIAL_LINKS.instagram, SOCIAL_LINKS.youtube],
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Doshhmukti',
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
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <QueryProvider>
          <FirebaseProvider />
          {children}
          <Toaster richColors position="top-right" />
        </QueryProvider>
      </body>
    </html>
  );
}
