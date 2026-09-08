'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { PaginatedOrders, Order, GstReport } from '@/types/api.types';

export function useOrders(status?: string) {
  return useQuery({
    queryKey: ['admin-orders', status],
    queryFn: () => api.get<PaginatedOrders>(`/api/admin/orders${status ? `?status=${status}` : ''}`),
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
    mutationFn: () => api.get<{ pdfUrl: string }>(`/api/admin/orders/${id}/shipment/label`),
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
