import { env } from '../config/env';
import { registerEkartWebhook } from '../shared/integrations/ekart/client';

// One-off: subscribes Ekart's track_updated push to this Backend.
//   npx tsx --env-file=.env src/scripts/register-ekart-webhook.ts
// Needs BACKEND_PUBLIC_URL (publicly reachable) and EKART_WEBHOOK_TOKEN in the env.
async function main() {
  if (!env.EKART_WEBHOOK_TOKEN) throw new Error('Set EKART_WEBHOOK_TOKEN first');
  if (!env.BACKEND_PUBLIC_URL) throw new Error('Set BACKEND_PUBLIC_URL first');
  const url = `${env.BACKEND_PUBLIC_URL}/api/webhooks/ekart?token=${encodeURIComponent(env.EKART_WEBHOOK_TOKEN)}`;
  // Ekart's own HMAC secret (6-30 chars) — we don't verify it, the URL token does that.
  const secret = env.EKART_WEBHOOK_TOKEN.slice(0, 30).padEnd(6, '0');
  const webhook = await registerEkartWebhook({ url, secret });
  console.log('Registered Ekart webhook', webhook.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
