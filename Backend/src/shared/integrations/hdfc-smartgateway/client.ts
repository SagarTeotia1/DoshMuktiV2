import crypto from 'crypto';
import { Juspay, APIError } from 'expresscheckout-nodejs';
import { env } from '../../../config/env';

export { APIError };

export const juspay = new Juspay({
  merchantId: env.HDFC_MERCHANT_ID,
  baseUrl: env.HDFC_BASE_URL,
  jweAuth: {
    keyId: env.HDFC_KEY_UUID,
    publicKey: env.HDFC_PUBLIC_KEY,
    privateKey: env.HDFC_PRIVATE_KEY,
  },
});

export interface CreateOrderSessionParams {
  orderId: string;
  amount: number;
  returnUrl: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  firstName?: string;
  lastName?: string;
}

export interface OrderSessionResult {
  sessionId: string;
  status: string;
  paymentLink: string;
}

// order_id here is always our own Order.orderNumber (DOSH-YYYYMMDD-NNNN) — SmartGateway
// uses whatever id the merchant sends as its own identifier for status/refund lookups,
// so there's no need to track a separate gateway-generated order id anywhere.
export async function createOrderSession(params: CreateOrderSessionParams): Promise<OrderSessionResult> {
  const session = await juspay.orderSession.create({
    order_id: params.orderId,
    amount: params.amount,
    payment_page_client_id: env.HDFC_PAYMENT_PAGE_CLIENT_ID,
    customer_id: params.customerId ?? '',
    customer_email: params.customerEmail,
    customer_phone: params.customerPhone,
    first_name: params.firstName,
    last_name: params.lastName,
    action: 'paymentPage',
    return_url: params.returnUrl,
    currency: 'INR',
  });

  const s = session as unknown as { id: string; status: string; payment_links?: { web?: string } };
  const paymentLink = s.payment_links?.web;
  if (!paymentLink) throw new Error('SmartGateway order session response missing payment_links.web');

  return {
    sessionId: String(s.id),
    status: String(s.status),
    paymentLink,
  };
}

export interface OrderStatusResult {
  orderId: string;
  status: string;
  amount: number;
  txnId?: string;
}

export async function getOrderStatus(orderId: string): Promise<OrderStatusResult> {
  const status = await juspay.order.status(orderId);
  const s = status as unknown as { order_id: string; status: string; amount: number; txn_id?: string; id?: string };
  return {
    orderId: s.order_id,
    status: s.status,
    amount: Number(s.amount),
    txnId: s.txn_id ?? s.id,
  };
}

// amountRupees is the full order total — always a full refund (this project has no
// partial-refund/return-one-item flow). unique_request_id must be <21 chars and never
// reused, so a retry after a transient failure passing the SAME id is what makes this
// idempotent — SmartGateway rejects/no-ops a duplicate request id rather than double-refunding.
//
// `status` mirrors SmartGateway's own refund lifecycle (docs: "Pending" — sent to the
// underlying PG but not yet settled, can take up to 10 days and land in manual review;
// "Success"; "Failure") — a 2xx from this call only means the refund request was
// *accepted*, not that money has actually moved yet. Callers must not treat this as a
// final "refunded" confirmation on its own.
export async function refundPayment(orderId: string, amountRupees: number, uniqueRequestId: string): Promise<{ refundId: string; status: string }> {
  const result = await juspay.order.refund(orderId, {
    unique_request_id: uniqueRequestId,
    order_id: orderId,
    amount: amountRupees,
  });
  const r = result as unknown as {
    id?: string;
    order_id: string;
    refunds?: Array<{ unique_request_id?: string; id?: string; status?: string }>;
  };
  // The refund block's exact shape isn't pinned down in the docs we have — refunds[] is
  // the documented "addition of refund block" on top of an order-status-shaped response.
  // Match this specific request by unique_request_id when more than one refund is present
  // (e.g. a prior partial attempt) rather than assuming array order.
  const thisRefund = r.refunds?.find((rf) => rf.unique_request_id === uniqueRequestId) ?? r.refunds?.[0];
  return { refundId: thisRefund?.id ?? r.id ?? orderId, status: thisRefund?.status ?? 'PENDING' };
}

// RFC 3986 percent-encoding — encodeURIComponent leaves !'()* unescaped, which the
// signature algorithm's "percentage encode" step requires escaped too.
function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

// HMAC-SHA256 verification for the return_url SmartGateway redirects the customer's
// browser to after payment. Every param except signature/signature_algorithm is
// percent-encoded, sorted by encoded key (ASCII), joined as an encoded query string, then
// HMAC'd with the dashboard Response Key — base64 output. Never trust this redirect alone
// for order fulfillment (the browser hop is spoofable) — it only gates whether we bother
// doing the authoritative server-to-server order-status call at all.
export function verifyReturnUrlSignature(query: Record<string, unknown>): boolean {
  const { signature, signature_algorithm: _alg, ...rest } = query;
  // A duplicated query key (?foo=a&foo=b) parses to an array, not a string — extremely
  // unlikely from SmartGateway itself, but a hand-crafted request could send one. Treat
  // anything that isn't a plain string as unsignable rather than letting it reach
  // encodeURIComponent (which would silently stringify an array via Array#toString).
  if (typeof signature !== 'string') return false;

  const encodedPairs = Object.entries(rest)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([k, v]) => [rfc3986Encode(k), rfc3986Encode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const baseString = encodedPairs.map(([k, v]) => `${k}=${v}`).join('&');
  const expectedHash = crypto.createHmac('sha256', env.HDFC_RESPONSE_KEY).update(baseString).digest('base64');

  let providedHash: string;
  try {
    providedHash = decodeURIComponent(signature);
  } catch {
    return false;
  }

  const expectedBuf = Buffer.from(expectedHash);
  const providedBuf = Buffer.from(providedHash);
  return expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// Webhook auth is HTTP Basic (dashboard-configured username/password), not HMAC — verify
// with timingSafeEqual, never `===`, per this repo's signature-verification rule.
export function verifyWebhookBasicAuth(authorizationHeader: string | undefined): boolean {
  if (!authorizationHeader?.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authorizationHeader.slice(6), 'base64').toString('utf8');
  const sepIndex = decoded.indexOf(':');
  if (sepIndex === -1) return false;

  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);
  const expectedUser = Buffer.from(env.HDFC_WEBHOOK_USERNAME);
  const expectedPass = Buffer.from(env.HDFC_WEBHOOK_PASSWORD);
  const userBuf = Buffer.from(user);
  const passBuf = Buffer.from(pass);

  const userOk = expectedUser.length === userBuf.length && crypto.timingSafeEqual(expectedUser, userBuf);
  const passOk = expectedPass.length === passBuf.length && crypto.timingSafeEqual(expectedPass, passBuf);
  return userOk && passOk;
}
