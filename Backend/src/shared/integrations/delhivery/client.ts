import { env } from '../../../config/env';

interface ServiceabilityResponse {
  delivery_codes: Array<{ postal_code: { pin: string; pre_paid: string; remarks?: string } }>;
}

export async function checkServiceability(pincode: string): Promise<boolean> {
  if (!env.DELHIVERY_API_KEY) return true; // graceful degrade in dev — assume serviceable

  const res = await fetch(
    `${env.DELHIVERY_BASE_URL}/c/api/pin-codes/json/?filter_codes=${pincode}`,
    { headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}` } }
  );
  if (!res.ok) return false;

  const data = (await res.json()) as ServiceabilityResponse;
  const postalCode = data.delivery_codes?.[0]?.postal_code;
  if (postalCode?.pre_paid !== 'Y') return false;
  // `pre_paid: Y` alone doesn't mean deliverable — Delhivery can carry an active
  // "Embargo" remark on a pincode (local disruption, strike, high-RTO suppression) that
  // silently rejects the actual shipment-create call later at booking time. Catching it
  // here, at checkout, is the only way the customer/admin ever sees it instead of a
  // shipment quietly stuck with no waybill days later.
  if (/embargo/i.test(postalCode.remarks ?? '')) return false;
  return true;
}

// Checkout accepts free-text address lines — customers paste from Maps/WhatsApp with
// stray ",,," and "..." runs left over from a trimmed original. Delhivery's own address
// parser can choke on those (a bad address is one of the few reject reasons it actually
// gives back via `remarks`), so collapse repeated commas/dots and trim edge punctuation
// before ever building the payload.
function sanitizeAddressLine(line: string): string {
  return line
    .replace(/\.{2,}/g, '.')
    .replace(/,{2,}/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/^[\s,.]+|[\s,.]+$/g, '')
    .trim();
}

export async function createShipment(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  weight: number;
}): Promise<{ waybill: string } | { error: string } | null> {
  if (!env.DELHIVERY_API_KEY) return null; // graceful degrade in dev

  const payload = {
    shipments: [
      {
        name: params.customerName,
        add: [params.address.line1, params.address.line2]
          .filter(Boolean)
          .map((line) => sanitizeAddressLine(line as string))
          .filter(Boolean)
          .join(', '),
        pin: params.address.pincode,
        city: params.address.city,
        state: params.address.state,
        country: 'India',
        phone: params.customerPhone,
        order: params.orderNumber,
        payment_mode: 'Prepaid',
        // 0, not the real order total — Delhivery prints total_amount as a Product/Price
        // table on the shipping label. That's meant for COD (courier needs to know what
        // to collect); on Prepaid it just exposes the order value to whoever handles the
        // package for no reason. Every order here is Prepaid (see payment_mode above).
        total_amount: 0,
        weight: params.weight,
      },
    ],
    pickup_location: { name: env.DELHIVERY_WAREHOUSE_NAME },
  };

  const res = await fetch(`${env.DELHIVERY_BASE_URL}/api/cmu/create.json`, {
    method: 'POST',
    headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}`, 'Content-Type': 'application/json' },
    body: `format=json&data=${JSON.stringify(payload)}`,
  });
  if (!res.ok) return { error: `Delhivery returned HTTP ${res.status}` };

  // Delhivery can return HTTP 200 with `success: false` and an empty waybill in the
  // package entry (e.g. its fraud/sanity check rejecting the order) — a naive check for
  // "packages[0] exists" alone silently treats that as a created shipment. `remarks` is
  // where the actual reject reason (bad pincode, address too long, etc) lives — surface
  // it instead of a generic "rejected", or every rejection looks identical to whoever's
  // debugging it.
  const data = (await res.json()) as {
    success?: boolean;
    packages: Array<{ waybill: string; status?: string; remarks?: string[] }>;
  };
  const pkg = data.packages?.[0];
  if (data.success === false || !pkg?.waybill) {
    const remarks = pkg?.remarks?.filter(Boolean).join('; ');
    return { error: remarks || 'Delhivery rejected the shipment with no reason given' };
  }
  return { waybill: pkg.waybill };
}

// ── Everything below is best-effort against Delhivery's documented legacy REST API
// (same family as the three functions above, which are confirmed working against this
// account) — the "one.delhivery.com" developer portal that describes these capabilities
// is login-gated, so none of these exact request/response shapes could be verified
// against real docs before shipping this code. Live-tested where noted; treat any
// untested one's first real call as the actual verification step.
//
// Warehouse create/edit is deliberately NOT implemented here — the pickup location is
// managed directly on Delhivery's own dashboard (already set up there), never through
// this app. DELHIVERY_WAREHOUSE_* env vars just mirror what's on file for reference.

export async function calculateShippingCost(params: {
  originPincode: string;
  destPincode: string;
  weightGrams: number;
  paymentMode: 'Pre-paid' | 'COD';
}): Promise<{ amount: number } | null> {
  if (!env.DELHIVERY_API_KEY) return null;

  const query = new URLSearchParams({
    md: 'S', // Surface — cheaper standard mode, not Express
    ss: 'Delivered',
    o_pin: params.originPincode,
    d_pin: params.destPincode,
    cgm: String(params.weightGrams),
    pt: params.paymentMode,
  });

  const res = await fetch(`${env.DELHIVERY_BASE_URL}/api/kinko/v1/invoice/charges/.json?${query}`, {
    headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}` },
  });
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as Array<{ total_amount?: number }> | null;
  const amount = data?.[0]?.total_amount;
  return typeof amount === 'number' ? { amount } : null;
}

export async function fetchShippingLabel(waybill: string): Promise<{ pdfUrl: string } | null> {
  if (!env.DELHIVERY_API_KEY) return null;

  const res = await fetch(`${env.DELHIVERY_BASE_URL}/api/p/packing_slip/?wbns=${waybill}&pdf=true`, {
    headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}` },
  });
  if (!res.ok) return null;

  const data = (await res.json().catch(() => null)) as { packages?: Array<{ pdf_download_link?: string }> } | null;
  const pdfUrl = data?.packages?.[0]?.pdf_download_link;
  return pdfUrl ? { pdfUrl } : null;
}

export async function raisePickupRequest(params: {
  pickupDate: string; // YYYY-MM-DD
  pickupTime: string; // HH:MM
  expectedPackageCount: number;
}): Promise<{ success: boolean; pickupId?: string; error?: string }> {
  if (!env.DELHIVERY_API_KEY) return { success: false, error: 'Delhivery not configured' };

  const res = await fetch(`${env.DELHIVERY_BASE_URL}/fm/request/new/`, {
    method: 'POST',
    headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pickup_time: params.pickupTime,
      pickup_date: params.pickupDate,
      pickup_location: env.DELHIVERY_WAREHOUSE_NAME,
      expected_package_count: params.expectedPackageCount,
    }),
  });
  if (!res.ok) return { success: false, error: `Delhivery returned ${res.status}` };

  const data = (await res.json().catch(() => ({}))) as { pickup_id?: string; error?: string };
  return { success: !data.error, pickupId: data.pickup_id, error: data.error };
}

export type NdrAction = 'REATTEMPT' | 'RTO';

export async function takeNdrAction(params: {
  waybill: string;
  action: NdrAction;
  reattemptDate?: string; // YYYY-MM-DD, required when action is REATTEMPT
  comment?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!env.DELHIVERY_API_KEY) return { success: false, error: 'Delhivery not configured' };

  const res = await fetch(`${env.DELHIVERY_BASE_URL}/api/p/update`, {
    method: 'POST',
    headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        {
          waybill: params.waybill,
          act: params.action,
          ...(params.reattemptDate ? { rt: params.reattemptDate } : {}),
          ...(params.comment ? { comment: params.comment } : {}),
        },
      ],
    }),
  });
  if (!res.ok) return { success: false, error: `Delhivery returned ${res.status}` };

  // Confirmed live: this endpoint replies 201 with {message, request_id} on acceptance —
  // there's no `success` field, and it accepts the request even against a waybill that
  // turns out to be invalid (validation happens asynchronously on Delhivery's side, not
  // in this response). So "success: true" here means "queued", not "confirmed applied" —
  // an `error` field appearing is the only synchronous failure signal available.
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  return { success: !data.error, error: data.error };
}

export async function updateEwaybill(params: {
  waybill: string;
  ewaybillNumber: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!env.DELHIVERY_API_KEY) return { success: false, error: 'Delhivery not configured' };

  const res = await fetch(`${env.DELHIVERY_BASE_URL}/api/p/edit`, {
    method: 'POST',
    headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ waybill: params.waybill, ewbn: params.ewaybillNumber }),
  });
  if (!res.ok) return { success: false, error: `Delhivery returned ${res.status}` };

  // This endpoint replies with XML, not JSON (confirmed against a live call) — parsing
  // it as JSON always throws, and the old catch-and-default-to-success masked every
  // real failure as a success. <status>Success</status>/<status>Failure</status> plus an
  // optional <error> tag is the actual shape.
  const text = await res.text();
  const status = /<status>(.*?)<\/status>/.exec(text)?.[1];
  const error = /<error>(.*?)<\/error>/.exec(text)?.[1];
  return { success: status === 'Success', error: error || undefined };
}
