import { env } from '../../../config/env';

// Ekart Logistics (Elite API). Request/response shapes follow Ekart's published OpenAPI
// spec (https://app.elite.ekartlogistics.in/api/docs). Contract mirrors
// delhivery/client.ts: null = integration not configured, { error } = rejected,
// { waybill } = success. `waybill` is Ekart's tracking_id — the id every later call
// (label, cancel, NDR, e-way bill, tracking) is keyed on.

export function isEkartConfigured(): boolean {
  return Boolean(env.EKART_CLIENT_ID && env.EKART_USERNAME && env.EKART_PASSWORD);
}

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

// Ekart caches the token server-side for ~24h, so re-fetching near expiry is cheap.
async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const res = await fetch(`${env.EKART_BASE_URL}/integrations/v2/auth/token/${env.EKART_CLIENT_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.EKART_USERNAME, password: env.EKART_PASSWORD }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    message?: string;
    description?: string;
  };
  if (!res.ok || !body.access_token) {
    cachedToken = null;
    throw new Error(`Ekart auth failed: ${body.message ?? res.status}${body.description ? ` — ${body.description}` : ''}`);
  }
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
}

async function ekartFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${env.EKART_BASE_URL}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  // Token revoked/rotated mid-cache — drop it so the next call re-auths.
  if (res.status === 401) cachedToken = null;
  return res;
}

async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { remark?: string; message?: string; description?: string } | null;
  return body?.remark ?? body?.description ?? body?.message ?? `Ekart returned HTTP ${res.status}`;
}

function phone10(raw: string): number {
  return Number(raw.replace(/\D/g, '').slice(-10));
}

function pickupLocation() {
  // Alias-only form is the documented way to reference an address registered with Ekart.
  if (env.EKART_PICKUP_ALIAS) return { name: env.EKART_PICKUP_ALIAS };
  return {
    location_type: 'Office',
    name: env.EKART_SELLER_NAME,
    address: env.DELHIVERY_WAREHOUSE_ADDRESS,
    city: env.DELHIVERY_WAREHOUSE_CITY,
    state: env.DELHIVERY_WAREHOUSE_STATE,
    country: 'India',
    phone: phone10(env.DELHIVERY_WAREHOUSE_PHONE),
    pin: Number(env.DELHIVERY_WAREHOUSE_PINCODE),
  };
}

export async function createEkartShipment(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: Address;
  weight: number; // grams
  /** Cash to collect on delivery; 0 for prepaid. Ekart caps this at 49,999. */
  codAmount: number;
  /** Full order value incl. GST and shipping. */
  orderTotal: number;
  /** GST inside orderTotal (inclusive breakup). */
  taxValue: number;
  productsDesc: string;
  quantity: number;
  invoiceDate: string; // YYYY-MM-DD
}): Promise<{ waybill: string } | { error: string } | null> {
  if (!isEkartConfigured()) return null;
  if (params.codAmount > 49_999) return { error: 'Ekart cannot collect more than ₹49,999 COD on one shipment' };

  const taxable = Math.max(params.orderTotal - params.taxValue, 1);
  const pickup = pickupLocation();
  const payload = {
    seller_name: env.EKART_SELLER_NAME,
    seller_address: env.EKART_SELLER_ADDRESS || env.DELHIVERY_WAREHOUSE_ADDRESS,
    seller_gst_tin: env.EKART_SELLER_GST_TIN,
    consignee_gst_amount: 0,
    order_number: params.orderNumber,
    invoice_number: params.orderNumber,
    invoice_date: params.invoiceDate,
    consignee_name: params.customerName,
    products_desc: params.productsDesc.slice(0, 200),
    payment_mode: params.codAmount > 0 ? 'COD' : 'Prepaid',
    category_of_goods: env.EKART_CATEGORY_OF_GOODS,
    total_amount: params.orderTotal,
    tax_value: params.taxValue,
    taxable_amount: taxable,
    commodity_value: String(taxable),
    cod_amount: params.codAmount,
    quantity: params.quantity,
    weight: Math.max(Math.round(params.weight), 1),
    length: env.EKART_PACKAGE_LENGTH_CM,
    width: env.EKART_PACKAGE_WIDTH_CM,
    height: env.EKART_PACKAGE_HEIGHT_CM,
    return_reason: '',
    service: 'SURFACE',
    drop_location: {
      location_type: 'Home',
      name: params.customerName,
      address: [params.address.line1, params.address.line2].filter(Boolean).join(', '),
      city: params.address.city,
      state: params.address.state,
      country: 'India',
      phone: phone10(params.customerPhone),
      pin: Number(params.address.pincode),
    },
    pickup_location: pickup,
    return_location: pickup,
  };

  let res: Response;
  try {
    res = await ekartFetch('/api/v1/package/create', { method: 'PUT', body: JSON.stringify(payload) });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Ekart request failed' };
  }
  if (!res.ok) return { error: await errorMessage(res) };

  const data = (await res.json()) as { status?: boolean; remark?: string; tracking_id?: string };
  if (data.status === false || !data.tracking_id) {
    return { error: data.remark || 'Ekart rejected the shipment with no reason given' };
  }
  return { waybill: data.tracking_id };
}

// Frees the parcel before pickup — used when an admin cancels the order.
export async function cancelEkartShipment(trackingId: string): Promise<{ success: boolean; error?: string }> {
  if (!isEkartConfigured()) return { success: false, error: 'Ekart not configured' };
  const res = await ekartFetch(`/api/v1/package/cancel?tracking_id=${encodeURIComponent(trackingId)}`, { method: 'DELETE' });
  if (!res.ok) return { success: false, error: await errorMessage(res) };
  const data = (await res.json().catch(() => ({}))) as { status?: boolean; remark?: string };
  return data.status === false ? { success: false, error: data.remark } : { success: true };
}

// PDF bytes of Ekart's own packing label (already print-ready — unlike Delhivery's, no
// re-sizing pass needed).
export async function fetchEkartLabelPdf(trackingId: string): Promise<Buffer | { error: string }> {
  if (!isEkartConfigured()) return { error: 'Ekart not configured' };
  const res = await ekartFetch('/api/v1/package/label?json_only=false', {
    method: 'POST',
    body: JSON.stringify({ ids: [trackingId] }),
  });
  if (!res.ok) return { error: await errorMessage(res) };
  return Buffer.from(await res.arrayBuffer());
}

export type EkartNdrAction = 'Re-Attempt' | 'RTO';

export async function takeEkartNdrAction(params: {
  trackingId: string;
  action: EkartNdrAction;
  reattemptDate?: string; // YYYY-MM-DD; Ekart wants it within the next 7 days, excluding today
  instructions?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isEkartConfigured()) return { success: false, error: 'Ekart not configured' };
  const body: Record<string, unknown> = { action: params.action, wbn: params.trackingId };
  if (params.action === 'Re-Attempt') {
    if (!params.reattemptDate) return { success: false, error: 'Re-attempt date is required' };
    body.date = new Date(`${params.reattemptDate}T09:00:00+05:30`).getTime();
  }
  if (params.instructions) body.instructions = params.instructions;

  const res = await ekartFetch('/api/v2/package/ndr', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) return { success: false, error: await errorMessage(res) };
  const data = (await res.json().catch(() => ({}))) as { status?: boolean; remark?: string };
  return data.status === false ? { success: false, error: data.remark } : { success: true };
}

export async function updateEkartEwaybill(trackingId: string, ewbn: string): Promise<{ success: boolean; error?: string }> {
  if (!isEkartConfigured()) return { success: false, error: 'Ekart not configured' };
  if (!/^\d{12}$/.test(ewbn)) return { success: false, error: 'Ekart e-way bill number must be 12 digits' };
  const res = await ekartFetch('/data/shipment/ewbn', { method: 'POST', body: JSON.stringify({ id: trackingId, ewbn }) });
  if (!res.ok) return { success: false, error: await errorMessage(res) };
  const data = (await res.json().catch(() => ({}))) as { status?: boolean; remark?: string };
  return data.status === false ? { success: false, error: data.remark } : { success: true };
}

export interface EkartTrack {
  status: string;
  desc: string;
  location: string;
  ndrStatus?: string;
  ctime: number;
}

// Open (unauthenticated) tracking endpoint — used by the polling fallback so it works
// even if credentials are rotated.
export async function fetchEkartTrack(trackingId: string): Promise<EkartTrack | null> {
  const res = await fetch(`${env.EKART_BASE_URL}/api/v1/track/${encodeURIComponent(trackingId)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { track?: { status: string; desc?: string; location?: string; ndrStatus?: string; ctime: number } };
  const t = data.track;
  if (!t?.status) return null;
  return { status: t.status, desc: t.desc ?? '', location: t.location ?? '', ndrStatus: t.ndrStatus, ctime: t.ctime };
}

// One-off: subscribe to tracking pushes. The `secret` (6–30 chars) is Ekart's HMAC key;
// the token in the URL is what our handler actually verifies (see webhooks/controller.ts).
export async function registerEkartWebhook(params: { url: string; secret: string }): Promise<{ id: string }> {
  const res = await ekartFetch('/api/v2/webhook', {
    method: 'POST',
    body: JSON.stringify({ url: params.url, secret: params.secret, topics: ['track_updated'], active: true }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as { id: string };
}
