import { env } from '../../../config/env';

// MSG91 WhatsApp Cloud API (template messages). Contract matches the other integration clients:
// never throws, returns { ok: true } or { ok: false, error, retryable }.
//
// Template `dosh_order_confirm` (UTILITY, en) - variables in order:
//   body_1 = customer name, body_2 = order number, body_3 = estimated delivery text,
//   button_1 = URL suffix; the button opens https://doshmukti.com/{{1}}, so the value is
//   `track/<publicToken>`.

const ENDPOINT = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
const REQUEST_TIMEOUT_MS = 15_000;

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.MSG91_WHATSAPP_AUTH_KEY && env.MSG91_WHATSAPP_NUMBER && env.MSG91_WHATSAPP_NAMESPACE);
}

/** Indian mobile -> MSG91 format (country code, no "+"): 9319811170 / +91 93198-11170 -> 919319811170. */
export function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 10 ? digits : null;
  return national && /^[6-9]\d{9}$/.test(national) ? `91${national}` : null;
}

// WhatsApp rejects template params with newlines, tabs or 4+ consecutive spaces, and caps length.
export function cleanTemplateText(value: string, max = 60): string {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max) || '-';
}

export interface OrderConfirmationParams {
  /** Any common Indian mobile format; validated here. */
  phone: string;
  customerName: string;
  orderNumber: string;
  /** e.g. "3 Nov - 6 Nov 2026" */
  deliveryText: string;
  /** Order.publicToken - the button link becomes /track/<token>. */
  publicToken: string;
}

export function buildOrderConfirmationPayload(p: OrderConfirmationParams, to: string) {
  return {
    integrated_number: env.MSG91_WHATSAPP_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: env.MSG91_WHATSAPP_ORDER_TEMPLATE,
        language: { code: 'en', policy: 'deterministic' },
        namespace: env.MSG91_WHATSAPP_NAMESPACE,
        to_and_components: [
          {
            to: [to],
            components: {
              body_1: { type: 'text', value: cleanTemplateText(p.customerName.split(/\s+/)[0] || p.customerName, 30) },
              body_2: { type: 'text', value: cleanTemplateText(p.orderNumber) },
              body_3: { type: 'text', value: cleanTemplateText(p.deliveryText) },
              button_1: { subtype: 'url', type: 'text', value: `track/${encodeURIComponent(p.publicToken)}` },
            },
          },
        ],
      },
    },
  };
}

export type WhatsAppResult = { ok: true; requestId: string | null } | { ok: false; error: string; retryable: boolean };

export async function sendOrderConfirmationWhatsApp(p: OrderConfirmationParams): Promise<WhatsAppResult> {
  if (!isWhatsAppConfigured()) return { ok: false, error: 'WhatsApp (MSG91) is not configured', retryable: false };
  const to = toWhatsAppNumber(p.phone);
  if (!to) return { ok: false, error: 'Not a valid Indian mobile number', retryable: false };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: env.MSG91_WHATSAPP_AUTH_KEY },
      body: JSON.stringify(buildOrderConfirmationPayload(p, to)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'MSG91 request failed', retryable: true };
  }

  const body = (await res.json().catch(() => null)) as {
    status?: string;
    hasError?: boolean;
    request_id?: string;
    message?: string;
    errors?: unknown;
    apiError?: string | number;
  } | null;

  if (!res.ok || !body || body.status === 'fail' || body.hasError === true || body.status === 'error') {
    const detail = body?.errors ?? body?.message ?? `HTTP ${res.status}`;
    const code = body?.apiError ? ` (apiError ${body.apiError}${String(body.apiError) === '418' ? ': server IP not allow-listed in MSG91' : ''})` : '';
    // 5xx / 429 are worth another try; auth, IP, template and number problems are not.
    return { ok: false, error: `${typeof detail === 'string' ? detail : JSON.stringify(detail)}${code}`, retryable: res.status >= 500 || res.status === 429 };
  }
  return { ok: true, requestId: body.request_id ?? null };
}
