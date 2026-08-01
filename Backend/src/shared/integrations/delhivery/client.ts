import { env } from '../../../config/env';

interface ServiceabilityResponse {
  delivery_codes: Array<{ postal_code: { pin: string; pre_paid: string } }>;
}

export async function checkServiceability(pincode: string): Promise<boolean> {
  if (!env.DELHIVERY_API_KEY) return true; // graceful degrade in dev — assume serviceable

  const res = await fetch(
    `${env.DELHIVERY_BASE_URL}/c/api/pin-codes/json/?filter_codes=${pincode}`,
    { headers: { Authorization: `Token ${env.DELHIVERY_API_KEY}` } }
  );
  if (!res.ok) return false;

  const data = (await res.json()) as ServiceabilityResponse;
  return data.delivery_codes?.[0]?.postal_code?.pre_paid === 'Y';
}

export async function createShipment(params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  totalAmount: number;
  weight: number;
}): Promise<{ waybill: string } | null> {
  if (!env.DELHIVERY_API_KEY) return null; // graceful degrade in dev

  const payload = {
    shipments: [
      {
        name: params.customerName,
        add: params.address.line1,
        pin: params.address.pincode,
        city: params.address.city,
        state: params.address.state,
        country: 'India',
        phone: params.customerPhone,
        order: params.orderNumber,
        payment_mode: 'Prepaid',
        total_amount: params.totalAmount,
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
  if (!res.ok) return null;

  const data = (await res.json()) as { packages: Array<{ waybill: string }> };
  return data.packages?.[0] ? { waybill: data.packages[0].waybill } : null;
}
