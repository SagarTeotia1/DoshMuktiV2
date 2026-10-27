import { env } from '../config/env';
import { registerEkartWebhook } from '../shared/integrations/ekart/client';
import { ekartConfig, type EkartAccount } from '../shared/integrations/ekart/accounts';

// One-off: subscribes Ekart's track_updated push to this Backend, per account.
//   npx tsx --env-file=.env src/scripts/register-ekart-webhook.ts 1   (prepaid account)
//   npx tsx --env-file=.env src/scripts/register-ekart-webhook.ts 2   (COD account)
// Needs BACKEND_PUBLIC_URL (publicly reachable) and that account's webhook token in the env.
async function main() {
  const arg = process.argv[2];
  if (arg !== '1' && arg !== '2') throw new Error('Usage: register-ekart-webhook.ts <1|2>');
  const account: EkartAccount = arg === '1' ? 1 : 2;
  const { webhookToken } = ekartConfig(account);
  if (!webhookToken) throw new Error(`Set the webhook token for Ekart account ${account} first`);
  if (!env.BACKEND_PUBLIC_URL) throw new Error('Set BACKEND_PUBLIC_URL first');
  const url = `${env.BACKEND_PUBLIC_URL}/api/webhooks/ekart?token=${encodeURIComponent(webhookToken)}`;
  // Ekart's own HMAC secret (6-30 chars) - we don't verify it, the URL token does that.
  const secret = webhookToken.slice(0, 30).padEnd(6, '0');
  const webhook = await registerEkartWebhook(account, { url, secret });
  console.log(`Registered Ekart account ${account} webhook`, webhook.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
