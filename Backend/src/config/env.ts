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
  RESEND_FROM_EMAIL: z.string().default('orders@doshhmukti.com'),

  DELHIVERY_API_KEY: z.string().default(''),
  DELHIVERY_BASE_URL: z.string().default('https://staging-express.delhivery.com'),
  DELHIVERY_WAREHOUSE_NAME: z.string().default('Doshhmukti Warehouse'),
  DELHIVERY_WAREHOUSE_PINCODE: z.string().default('110001'),
  DELHIVERY_WAREHOUSE_CITY: z.string().default('New Delhi'),
  DELHIVERY_WAREHOUSE_STATE: z.string().default('Delhi'),
  DELHIVERY_WAREHOUSE_ADDRESS: z.string().default(''),
  DELHIVERY_WAREHOUSE_PHONE: z.string().default(''),
  DELHIVERY_CLIENT_NAME: z.string().default('Doshhmukti'),

  MSG91_AUTH_KEY: z.string().default(''),
  MSG91_TEMPLATE_ID: z.string().default(''),

  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),

  CRON_SECRET: z.string().min(32),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables — check server logs for details');
}

export const env = parsed.data;
