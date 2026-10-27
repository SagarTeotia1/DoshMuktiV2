import { db } from '../db/client';
import { logger } from '../logger/pino';
import { isWhatsAppConfigured, sendOrderConfirmationWhatsApp } from '../integrations/msg91/whatsapp';
import { estimateDeliveryWindow, formatDeliveryWindowText } from '../shipping/deliveryEstimate';

export type WhatsAppConfirmOutcome = 'sent' | 'already_sent' | 'disabled' | 'order_not_found' | 'failed';

const RETRY_DELAY_MS = 2_000;

// Sends the "order confirmed" WhatsApp (template dosh_order_confirm) at most once per order.
// The marker is claimed atomically BEFORE sending (UPDATE ... WHERE whatsappConfirmSentAt IS NULL),
// so a payment-webhook replay or two racing triggers can never message the customer twice; if the
// send ultimately fails the claim is released so it can be retried (Admin "Resend"). Never throws -
// a messaging problem must not affect the order.
export async function sendOrderWhatsAppConfirmation(orderId: string, opts: { force?: boolean } = {}): Promise<{ outcome: WhatsAppConfirmOutcome; error?: string }> {
  if (!isWhatsAppConfigured()) return { outcome: 'disabled' };

  let claimed = false;
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, customerName: true, customerPhone: true, publicToken: true, createdAt: true },
    });
    if (!order) return { outcome: 'order_not_found' };

    if (opts.force) await db.order.update({ where: { id: orderId }, data: { whatsappConfirmSentAt: null } });
    const claim = await db.order.updateMany({ where: { id: orderId, whatsappConfirmSentAt: null }, data: { whatsappConfirmSentAt: new Date() } });
    if (claim.count === 0) return { outcome: 'already_sent' };
    claimed = true;

    // Status is "PAID" for the estimate: this runs at confirmation, where the window is promised from.
    const window = estimateDeliveryWindow(order.createdAt, 'PAID');
    const params = {
      phone: order.customerPhone,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      deliveryText: window ? formatDeliveryWindowText(window) : 'within 4-7 days',
      publicToken: order.publicToken,
    };

    let result = await sendOrderConfirmationWhatsApp(params);
    if (!result.ok && result.retryable) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      result = await sendOrderConfirmationWhatsApp(params);
    }

    if (result.ok) {
      logger.info({ orderNumber: order.orderNumber, requestId: result.requestId }, 'WhatsApp order confirmation sent');
      return { outcome: 'sent' };
    }
    await db.order.update({ where: { id: orderId }, data: { whatsappConfirmSentAt: null } });
    logger.error({ orderNumber: order.orderNumber, reason: result.error }, 'WhatsApp order confirmation failed');
    return { outcome: 'failed', error: result.error };
  } catch (err) {
    logger.error({ err, orderId }, 'WhatsApp order confirmation crashed');
    // Best effort: free the claim THIS call took so a retry is possible (never clear an earlier send's marker).
    if (claimed) await db.order.updateMany({ where: { id: orderId }, data: { whatsappConfirmSentAt: null } }).catch(() => undefined);
    return { outcome: 'failed', error: err instanceof Error ? err.message : 'unexpected error' };
  }
}
