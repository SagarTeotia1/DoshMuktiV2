import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { env } from './config/env';
import { logger } from './shared/logger/pino';
import { errorHandler } from './shared/middleware/error-handler';

import { authRoutes } from './modules/auth/routes';
import { productsRoutes } from './modules/products/routes';
import { cartRoutes } from './modules/cart/routes';
import { serviceabilityRoutes } from './modules/serviceability/routes';
import { checkoutRoutes } from './modules/checkout/routes';
import { webhookRoutes } from './modules/webhooks/routes';
import { orderRoutes } from './modules/orders/routes';
import { inventoryRoutes } from './modules/inventory/routes';
import { uploadRoutes } from './modules/upload/routes';
import { dashboardRoutes } from './modules/dashboard/routes';
import { offersRoutes } from './modules/offers/routes';
import { couponsRoutes } from './modules/coupons/routes';
import { walletRoutes } from './modules/wallet/routes';
import { reviewsRoutes } from './modules/reviews/routes';
import { chatRoutes } from './modules/chat/routes';
import { bannersRoutes } from './modules/banners/routes';
import { jobRoutes } from './jobs/routes';

export async function buildApp() {
  const app = Fastify({ loggerInstance: logger, bodyLimit: 10 * 1024 * 1024 });

  await app.register(helmet);
  await app.register(cors, {
    origin: [...env.FRONTEND_ORIGIN, env.ADMIN_ORIGIN], // storefront (possibly multiple origins in dev) + admin panel
    credentials: false, // auth is Bearer/header-based, not cookie-based across origins
  });
  await app.register(rateLimit, { global: false }); // per-route limits set in each module
  await app.register(jwt, { secret: env.JWT_SECRET });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // Raw body capture for the Razorpay webhook — HMAC verification needs the
  // exact bytes, not the JSON-reparsed object. See docs/PATTERNS.md.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      (req as unknown as { rawBody: string }).rawBody = body as string;
      try {
        done(null, body === '' ? {} : JSON.parse(body as string));
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  app.setErrorHandler(errorHandler);

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(productsRoutes, { prefix: '/api' });
  await app.register(cartRoutes, { prefix: '/api' });
  await app.register(serviceabilityRoutes, { prefix: '/api' });
  await app.register(checkoutRoutes, { prefix: '/api' });
  await app.register(webhookRoutes, { prefix: '/api' });
  await app.register(orderRoutes, { prefix: '/api' });
  await app.register(inventoryRoutes, { prefix: '/api' });
  await app.register(uploadRoutes, { prefix: '/api' });
  await app.register(dashboardRoutes, { prefix: '/api' });
  await app.register(offersRoutes, { prefix: '/api' });
  await app.register(couponsRoutes, { prefix: '/api' });
  await app.register(walletRoutes, { prefix: '/api' });
  await app.register(reviewsRoutes, { prefix: '/api' });
  await app.register(chatRoutes, { prefix: '/api' });
  await app.register(bannersRoutes, { prefix: '/api' });
  await app.register(jobRoutes, { prefix: '/api' });

  return app;
}
