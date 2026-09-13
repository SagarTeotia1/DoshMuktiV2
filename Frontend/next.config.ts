import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // microphone=(self) — Acharya chat's voice input (useVoiceInput) needs it; microphone=()
  // blocked it site-wide and made desktop Chrome fail with "not-allowed" before ever
  // prompting the user (mobile browsers were more lenient about the policy, masking it there).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
];

// Same public, stale-while-revalidate convention as Backend's setPublicCache (see
// Backend/src/shared/http/cacheControl.ts) — max-age matches these pages' own ISR
// `revalidate` window, so nginx/any CDN in front and every visitor's browser can serve
// a shared cached copy instead of hitting the Node process on every request.
const campaignPageCacheHeaders = [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }];

const nextConfig: NextConfig = {
  output: 'standalone',
  // Pin explicitly — a package-lock.json one level up (C:\Users\acer) otherwise makes
  // Turbopack guess wrong about the workspace root and warn on every build.
  turbopack: { root: __dirname },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: 'r2.sagarteotia.in' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
    // R2 product images are content-addressed (nanoid key per upload, never overwritten),
    // so it's safe for Next's image optimizer to hold onto the optimized output for a year
    // instead of the ~60s default.
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/vahan-suraksha-kavach', headers: campaignPageCacheHeaders },
      { source: '/durghatna-nashak-yantra', headers: campaignPageCacheHeaders },
      { source: '/durbhagya-nashak-nariyal', headers: campaignPageCacheHeaders },
      { source: '/rose-quartz-bracelet', headers: campaignPageCacheHeaders },
    ];
  },
};

export default nextConfig;
