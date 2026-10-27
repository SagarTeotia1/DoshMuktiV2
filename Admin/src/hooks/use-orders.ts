'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedOrders, Order, GstReport } from '@/types/api.types';

export function useOrders(
  status?: string,
  dateRange?: { from?: string; to?: string },
  page = 1,
  limit = 20,
  q?: string,
  paymentMethod?: 'COD' | 'PREPAID',
) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  if (paymentMethod) params.set('paymentMethod', paymentMethod);
  if (dateRange?.from) params.set('from', dateRange.from);
  if (dateRange?.to) params.set('to', dateRange.to);
  params.set('page', String(page));
  params.set('limit', String(limit));
  const qs = params.toString();

  return useQuery({
    queryKey: ['admin-orders', status, dateRange?.from, dateRange?.to, page, limit, q, paymentMethod],
    queryFn: () => api.get<PaginatedOrders>(`/api/admin/orders?${qs}`),
    placeholderData: (prev) => prev,
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => api.get<Order>(`/api/admin/orders/${id}`),
    enabled: !!id,
  });
}

export function useGstReport(from: string, to: string) {
  return useQuery({
    queryKey: ['admin-gst-report', from, to],
    queryFn: () => api.get<GstReport>(`/api/admin/orders/gst-report?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
}

// refundError is only ever set on a CANCELLED transition where the prepaid refund
// itself failed (Razorpay down, etc) — the status change still committed regardless,
// see orders/service.ts's updateOrderStatus.
export function useUpdateOrderStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: string; note?: string }) =>
      api.patch<Order & { refundError?: string }>(`/api/admin/orders/${id}/status`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
    },
  });
}

// Not a mutation — fetches on demand and returns the PDF URL, no server state changes.
export function useGenerateLabel(id: string) {
  return useMutation({
    mutationFn: (size: '4x6' | 'A4') =>
      api.get<{ pdfBase64: string }>(`/api/admin/orders/${id}/shipment/label?size=${size}`),
  });
}

// Manual retry for the auto-book-on-payment webhook, which is fire-and-forget and can
// fail silently (Delhivery rejection, network blip) — see webhooks/service.ts.
export function useBookShipment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ waybill: string }>(`/api/admin/orders/${id}/shipment/book`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-order', id] }),
  });
}

// Sends the WhatsApp "order confirmed" message again (first send failed, or the customer's
// number changed). The backend replies 502 with MSG91's reason if it is rejected.
export function useResendWhatsApp(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ sent: boolean }>(`/api/admin/orders/${id}/whatsapp-confirmation`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
}

export type SyncMode = 'shipped' | 'delivered';

// On-demand carrier tracking sync, one bounded batch per click:
//   shipped   - BOOKED parcels: picked up yet? (order PACKED -> SHIPPED)
//   delivered - IN_TRANSIT / OUT_FOR_DELIVERY parcels: delivered yet? (-> DELIVERED)
// totalOpen > checked means more parcels are waiting — click again.
export function useSyncTracking(mode: SyncMode) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ synced: number; checked: number; totalOpen: number }>(`/api/admin/orders/sync-tracking?mode=${mode}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-order'] });
    },
  });
}

export function useNdrAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { action: 'REATTEMPT' | 'RTO'; reattemptDate?: string; comment?: string }) =>
      api.post<void>(`/api/admin/orders/${id}/shipment/ndr`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-order', id] }),
  });
}

export function useUpdateEwaybill(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ewaybillNumber: string }) => api.post<void>(`/api/admin/orders/${id}/shipment/ewaybill`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-order', id] }),
  });
}

// Overrides the declared parcel weight used when this order's shipment gets booked
// (manual retry or the payment.captured auto-book) — null clears it back to the
// auto-calculated item-sum + packaging estimate. Only takes effect before booking;
// Delhivery doesn't support editing a shipment's declared weight after the fact.
export function useUpdatePackageWeight(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weight: number | null) => api.patch<void>(`/api/admin/orders/${id}/package-weight`, { weight }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-order', id] }),
  });
}

// Flag/unflag a shipment as bad-address or high-risk. Flagging pulls it out of the
// pickup batch queue (see Backend pickup-requests/service.ts); passing riskFlag: null
// clears it, same as resolving via an NDR action.
export function useSetRiskFlag(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { riskFlag: 'BAD_ADDRESS' | 'HIGH_RISK' | null; riskReason?: string }) =>
      api.patch<void>(`/api/admin/orders/${id}/shipment/risk-flag`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
      qc.invalidateQueries({ queryKey: ['admin-pickup-pending-count'] });
    },
  });
}
