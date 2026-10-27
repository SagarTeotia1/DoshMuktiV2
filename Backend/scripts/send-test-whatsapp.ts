// One-off: sends the real `dosh_order_confirm` template to a phone, with sample order data, to
// verify MSG91 credentials, IP allow-list and the template mapping. No database involved.
//   npx tsx --env-file=.env scripts/send-test-whatsapp.ts 9319811170 [FirstName]
import { sendOrderConfirmationWhatsApp, toWhatsAppNumber } from '../src/shared/integrations/msg91/whatsapp';
import { estimateDeliveryWindow, formatDeliveryWindowText } from '../src/shared/shipping/deliveryEstimate';

async function main() {
  const phone = process.argv[2];
  if (!phone || !toWhatsAppNumber(phone)) throw new Error('Usage: send-test-whatsapp.ts <10-digit Indian mobile> [name]');
  const window = estimateDeliveryWindow(new Date(), 'PAID');
  const result = await sendOrderConfirmationWhatsApp({
    phone,
    customerName: process.argv[3] ?? 'Sagar',
    orderNumber: 'DOSH-TEST-0001',
    deliveryText: window ? formatDeliveryWindowText(window) : 'within 4-7 days',
    publicToken: 'testtoken0000000',
  });
  console.log(result);
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
