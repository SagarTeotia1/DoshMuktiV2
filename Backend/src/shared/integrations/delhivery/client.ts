// Delhivery disconnected — every function below is an inert stub and makes no
// network calls. Each returns the same "not configured" fallback its caller
// already knew how to handle, so callers weren't touched. Restore the real
// fetch() calls (see git history) to reconnect.

export async function checkServiceability(_pincode: string): Promise<boolean> {
  return true; // assume serviceable
}

export async function createShipment(_params: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: { line1: string; line2?: string; city: string; state: string; pincode: string };
  weight: number;
}): Promise<{ waybill: string } | null> {
  return null;
}

export async function calculateShippingCost(_params: {
  originPincode: string;
  destPincode: string;
  weightGrams: number;
  paymentMode: 'Pre-paid' | 'COD';
}): Promise<{ amount: number } | null> {
  return null;
}

export async function fetchShippingLabel(_waybill: string): Promise<{ pdfUrl: string } | null> {
  return null;
}

export async function raisePickupRequest(_params: {
  pickupDate: string;
  pickupTime: string;
  expectedPackageCount: number;
}): Promise<{ success: boolean; pickupId?: string; error?: string }> {
  return { success: false, error: 'Delhivery disconnected' };
}

export type NdrAction = 'REATTEMPT' | 'RTO';

export async function takeNdrAction(_params: {
  waybill: string;
  action: NdrAction;
  reattemptDate?: string;
  comment?: string;
}): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Delhivery disconnected' };
}

export async function updateEwaybill(_params: {
  waybill: string;
  ewaybillNumber: string;
}): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Delhivery disconnected' };
}
