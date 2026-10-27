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

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().min(1),

  AI_BOT_SERVICE_KEY: z.string().default(''),

  UPSTASH_REDIS_REST_URL: z.string().default(''),
  UPSTASH_REDIS_REST_TOKEN: z.string().default(''),

  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),

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

  // Ekart Logistics (Elite API, spec: https://app.elite.ekartlogistics.in/api/docs) —
  // two accounts (see shared/shipping/carrier.ts): account 1 (EKART1_*) is first choice for
  // prepaid orders, account 2 (EKART_*) is first choice for COD. Delhivery is used only when
  // Ekart says the pincode isn't serviceable. Empty credentials = that account is off:
  // booking fails with a clear error instead of silently falling back.
  EKART_BASE_URL: z.string().url().default('https://app.elite.ekartlogistics.in'),
  // Account 1 — prepaid. Own credentials, pickup alias and webhook token.
  EKART1_CLIENT_ID: z.string().default(''),
  EKART1_USERNAME: z.string().default(''),
  EKART1_PASSWORD: z.string().default(''),
  EKART1_PICKUP_ALIAS: z.string().default(''),
  EKART1_WEBHOOK_TOKEN: z.string().default(''),
  // Account 2 — COD (the original single-account EKART_* vars).
  EKART_CLIENT_ID: z.string().default(''),
  EKART_USERNAME: z.string().default(''),
  EKART_PASSWORD: z.string().default(''),
  // If the Ekart account has several registered pickup addresses, the alias to use
  // (Ekart dashboard -> addresses). Empty = send the DELHIVERY_WAREHOUSE_* address in full.
  EKART_PICKUP_ALIAS: z.string().default(''),
  // Seller billing details Ekart requires on every shipment.
  EKART_SELLER_NAME: z.string().default('Doshhmukti'),
  EKART_SELLER_ADDRESS: z.string().default(''),
  EKART_SELLER_GST_TIN: z.string().default('NA'),
  EKART_CATEGORY_OF_GOODS: z.string().default('Others'),
  // Default box (cm) for every parcel.
  EKART_PACKAGE_LENGTH_CM: z.coerce.number().int().min(1).default(15),
  EKART_PACKAGE_WIDTH_CM: z.coerce.number().int().min(1).default(12),
  EKART_PACKAGE_HEIGHT_CM: z.coerce.number().int().min(1).default(8),
  // Shared secret carried in the webhook URL we register with Ekart (?token=...). Ekart's
  // spec documents an HMAC secret but not the signature header, so the URL token is what
  // we can actually verify. Register via src/scripts/register-ekart-webhook.ts.
  EKART_WEBHOOK_TOKEN: z.string().default(''),
  // Publicly reachable base URL of this backend (used by the Ekart webhook registration script).
  BACKEND_PUBLIC_URL: z.string().default('').transform((s) => s.replace(/\/+$/, '')),

  TWOFACTOR_API_KEY: z.string().default(''),

  // Flash-tier model: fast latency for a chat UX, cheap, solid Hinglish output.
  // Override per-deployment via env without a code change.
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_MODEL: z.string().default('google/gemini-2.5-flash'),

  CRON_SECRET: z.string().min(32),

  // WhatsApp order confirmation via MSG91 (shared/integrations/msg91/whatsapp.ts). The authkey has
  // IP Security on - the server's public IP must be allow-listed in MSG91 or every call is
  // rejected with apiError 418. Any of the three empty = feature off (orders are unaffected).
  MSG91_WHATSAPP_AUTH_KEY: z.string().default(''),
  MSG91_WHATSAPP_NUMBER: z.string().regex(/^\d*$/, 'digits only, with country code').default(''),
  MSG91_WHATSAPP_NAMESPACE: z.string().default(''),
  MSG91_WHATSAPP_ORDER_TEMPLATE: z.string().default('dosh_order_confirm'),

  // Nightly encrypted database backup (jobs/db-backup.ts, restore with scripts/restore-backup.ts).
  // BACKUP_R2_BUCKET must be a PRIVATE bucket, never the public images bucket. Empty = the job
  // fails loudly instead of silently doing nothing. Key: `openssl rand -hex 32` - keep a copy
  // OUTSIDE this server (password manager): without it every backup is unreadable.
  BACKUP_R2_BUCKET: z.string().default(''),
  BACKUP_ENCRYPTION_KEY: z.string().regex(/^([0-9a-fA-F]{64})?$/, 'BACKUP_ENCRYPTION_KEY must be 64 hex chars').default(''),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(7).max(3650).default(30),
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
