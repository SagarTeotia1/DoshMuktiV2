import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Comma-separated so local dev can allow both localhost and a LAN IP at once
  // (e.g. for testing the storefront on a phone against the same dev backend).
  FRONTEND_ORIGIN: z
    .string()
    .transform((s) => s.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.string().url()).min(1)),
  ADMIN_ORIGIN: z.string().url(),
  // This service's own publicly reachable base URL — needed to build the return_url
  // SmartGateway redirects the customer's browser to after payment (must be a fully
  // qualified URL the bank's servers/browser can reach, not localhost in production).
  // Stripped of a trailing slash — checkout/service.ts builds return_url as
  // `${BACKEND_PUBLIC_URL}/api/checkout/return`, and a trailing-slash value here would
  // otherwise produce a double slash that SmartGateway's return_url validation may reject
  // outright ("shouldn't contain ... # symbol" etc — a stray // is the same class of issue).
  BACKEND_PUBLIC_URL: z.string().url().transform((s) => s.replace(/\/+$/, '')),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().min(1),

  AI_BOT_SERVICE_KEY: z.string().default(''),

  UPSTASH_REDIS_REST_URL: z.string().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(''),

  // HDFC SmartGateway (expresscheckout) — replaces Razorpay. Private/public keys are
  // PEM contents (not file paths) so the same env-var deployment story as every other
  // secret here (Cloud Run env, not a mounted volume) keeps working.
  HDFC_MERCHANT_ID: z.string().min(1),
  HDFC_PAYMENT_PAGE_CLIENT_ID: z.string().min(1),
  HDFC_KEY_UUID: z.string().min(1),
  HDFC_PRIVATE_KEY: z.string().min(1),
  HDFC_PUBLIC_KEY: z.string().min(1),
  // HMAC key from Dashboard → Settings → General → "Use signed response" — verifies the
  // return_url query string the bank redirects the customer's browser to.
  HDFC_RESPONSE_KEY: z.string().min(1),
  HDFC_BASE_URL: z.string().url().default('https://smartgateway.hdfcuat.bank.in'),
  // Basic-auth credentials configured in Dashboard → Payments → Settings → Webhook —
  // SmartGateway sends these back on every webhook call for us to check.
  HDFC_WEBHOOK_USERNAME: z.string().min(1),
  HDFC_WEBHOOK_PASSWORD: z.string().min(1),

  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET_NAME: z.string().default('doshhmukti-images'),
  R2_PUBLIC_URL: z.string().default(''),

  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().default('orders@doshmukti.com'),

  DELHIVERY_API_KEY: z.string().default(''),
  DELHIVERY_WEBHOOK_TOKEN: z.string().min(1),
  DELHIVERY_BASE_URL: z.string().default('https://staging-express.delhivery.com'),
  DELHIVERY_WAREHOUSE_NAME: z.string().default('Doshhmukti Warehouse'),
  DELHIVERY_WAREHOUSE_PINCODE: z.string().default('110001'),
  DELHIVERY_WAREHOUSE_CITY: z.string().default('New Delhi'),
  DELHIVERY_WAREHOUSE_STATE: z.string().default('Delhi'),
  DELHIVERY_WAREHOUSE_ADDRESS: z.string().default(''),
  DELHIVERY_WAREHOUSE_PHONE: z.string().default(''),
  DELHIVERY_CLIENT_NAME: z.string().default('Doshhmukti'),

  TWOFACTOR_API_KEY: z.string().default(''),

  // Flash-tier model: fast latency for a chat UX, cheap, solid Hinglish output.
  // Override per-deployment via env without a code change.
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_MODEL: z.string().default('google/gemini-2.5-flash'),

  CRON_SECRET: z.string().min(32),
});

// Docker's `--env-file` (used in production, see root Dockerfile/entrypoint.sh) does
// NOT strip surrounding quotes from values — unlike Node's own `--env-file` flag used
// in local dev, which does. The same .env file with `KEY="value"` lines then silently
// carries literal quote characters into every value in production only, breaking
// anything that builds a URL or sends the value to an external API (Delhivery,
// Razorpay, etc) — see the "Failed to parse URL" class of bug this caused. Stripping
// one matching pair of leading/trailing quotes here makes env loading behave the same
// regardless of which of the two loaders actually read the file.
const unquoted = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [
    key,
    typeof value === 'string' ? value.replace(/^(['"])(.*)\1$/, '$2') : value,
  ])
);

const parsed = envSchema.safeParse(unquoted);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables — check server logs for details');
}

export const env = parsed.data;
