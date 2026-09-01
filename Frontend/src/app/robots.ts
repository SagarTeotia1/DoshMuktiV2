import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';

// AI crawlers explicitly allowed — GEO visibility (ChatGPT/Perplexity/Claude/Gemini
// citing this site) needs them able to fetch product/content pages. Cart, checkout,
// account and admin-adjacent paths stay blocked from every agent, human-search or AI.
export default function robots(): MetadataRoute.Robots {
  const disallow = ['/cart', '/checkout', '/checkout/success', '/profile', '/orders', '/login', '/api/'];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: 'GPTBot', allow: '/', disallow },
      { userAgent: 'ChatGPT-User', allow: '/', disallow },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow },
      { userAgent: 'PerplexityBot', allow: '/', disallow },
      { userAgent: 'ClaudeBot', allow: '/', disallow },
      { userAgent: 'Claude-User', allow: '/', disallow },
      { userAgent: 'Google-Extended', allow: '/', disallow },
      { userAgent: 'anthropic-ai', allow: '/', disallow },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
