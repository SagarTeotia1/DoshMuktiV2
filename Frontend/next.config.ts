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
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
