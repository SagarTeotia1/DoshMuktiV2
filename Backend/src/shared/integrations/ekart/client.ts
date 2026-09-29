import { env } from '../../../config/env';

// Ekart Logistics client. The HTTP calls below are a first pass against Ekart's Elite
// API and are UNVERIFIED — auth/booking request shapes must be checked against the real
// docs and credentials before relying on them. Mirrors delhivery/client.ts's contract:
// returns null when not configured, { error } on rejection, { waybill } on success.

export function isEkartConfigured(): boolean {
  return Boolean(env.EKART_CLIENT_ID && env.EKART_USERNAME && env.EKART_PASSWORD);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(`${env.EKART_BASE_URL}/integrations/v2/auth/token/${env.EKART_CLIENT_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.EKART_USERNAME, password: env.EKART_PASSWORD }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

export async function createEkartShipment(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  weight: number;
  /** Cash to collect on delivery; 0 for prepaid. */
  codAmount: number;
  /** Full order value, for the declared value / invoice on the parcel. */
  orderTotal: number;
}): Promise<{ waybill: string } | { error: string } | null> {
  if (!isEkartConfigured()) return { error: 'Ekart is not configured (set EKART_CLIENT_ID / EKART_USERNAME / EKART_PASSWORD)' };

  const token = await getAccessToken();
  if (!token) return { error: 'Ekart authentication failed' };

  const payload = {
    seller_name: env.DELHIVERY_CLIENT_NAME,
    order_number: params.orderNumber,
    payment_mode: params.codAmount > 0 ? 'COD' : 'Prepaid',
    cod_amount: params.codAmount,
    total_amount: params.orderTotal,
    weight: params.weight,
    drop_location: {
      name: params.customerName,
      phone: params.customerPhone,
      address: [params.address.line1, params.address.line2].filter(Boolean).join(', '),
      city: params.address.city,
      state: params.address.state,
      pin: params.address.pincode,
    },
    pickup_location: { name: env.DELHIVERY_WAREHOUSE_NAME, pin: env.DELHIVERY_WAREHOUSE_PINCODE },
  };

  const res = await fetch(`${env.EKART_BASE_URL}/api/v1/package/create`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { error: `Ekart returned HTTP ${res.status}` };

  const data = (await res.json()) as { status?: boolean; tracking_id?: string; remark?: string };
  if (data.status === false || !data.tracking_id) {
    return { error: data.remark || 'Ekart rejected the shipment with no reason given' };
  }
  return { waybill: data.tracking_id };
}
