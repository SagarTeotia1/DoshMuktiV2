'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Topbar } from '@/components/layout/Topbar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useOrder, useUpdateOrderStatus } from '@/hooks/use-orders';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ORDER_STATUSES } from '@/lib/constants';
import { ApiError } from '@/lib/api-client';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading } = useOrder(id);
  const updateStatus = useUpdateOrderStatus(id);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  function confirmStatusChange() {
    if (!pendingStatus) return;
    updateStatus.mutate(
      { status: pendingStatus },
      {
        onSuccess: () => toast.success('Order status updated'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update status'),
        onSettled: () => setPendingStatus(null),
      }
    );
  }

  function startPackaging() {
    updateStatus.mutate(
      { status: 'PROCESSING' },
      {
        onSuccess: () => toast.success('Order marked as packaging started'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update status'),
      }
    );
  }

  function markPackagingDone() {
    updateStatus.mutate(
      { status: 'PACKED' },
      {
        onSuccess: () => toast.success('Order marked as packed'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update status'),
      }
    );
  }

  if (isLoading || !order) {
    return (
      <>
        <Topbar title="Order" />
        <div className="p-6 text-sm text-slate-400">Loading...</div>
      </>
    );
  }

  return (
    <>
      <Topbar title={order.orderNumber} />
      <div className="p-6 grid lg:grid-cols-[1.5fr_1fr] gap-6">
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <StatusBadge status={order.status} />
              <span className="text-xs text-slate-400">{formatDate(order.createdAt)}</span>
            </div>

            <h2 className="font-heading font-bold text-sm text-slate-900 mb-3">Items</h2>
            <div className="flex flex-col gap-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-slate-700">
                    {item.variantSnapshot.productName} ({item.variantSnapshot.sku}) × {item.quantity}
                  </span>
                  <span className="text-slate-900 font-medium">{formatCurrency(item.priceAtPurchase * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 mt-4 pt-4 flex flex-col gap-1">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Shipping</span>
                <span>{order.shippingFee === 0 ? 'Free' : formatCurrency(order.shippingFee)}</span>
              </div>
              <div className="flex justify-between font-heading font-bold text-slate-900 pt-1">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {order.statusLog && order.statusLog.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
              <h2 className="font-heading font-bold text-sm text-slate-900 mb-3">Status History</h2>
              <div className="flex flex-col gap-2">
                {order.statusLog.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{log.from}</span>
                    <span>→</span>
                    <span className="font-semibold text-slate-700">{log.to}</span>
                    <span className="ml-auto">{formatDate(log.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
            <h2 className="font-heading font-bold text-sm text-slate-900 mb-3">Customer</h2>
            <p className="text-sm text-slate-700">{order.customerName}</p>
            <p className="text-sm text-slate-500">{order.customerPhone}</p>
            {order.customerEmail && <p className="text-sm text-slate-500">{order.customerEmail}</p>}
            <p className="text-sm text-slate-500 mt-2">
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
            </p>
          </div>

          {order.payment && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
              <h2 className="font-heading font-bold text-sm text-slate-900 mb-2">Payment</h2>
              <p className="text-sm text-slate-500">Status: {order.payment.status}</p>
              {order.payment.razorpayPaymentId && <p className="text-xs text-slate-400 mt-1">{order.payment.razorpayPaymentId}</p>}
            </div>
          )}

          {order.shipment && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
              <h2 className="font-heading font-bold text-sm text-slate-900 mb-2">Shipment</h2>
              <p className="text-sm text-slate-500">Status: {order.shipment.status}</p>
              {order.shipment.delhiveryWaybill && <p className="text-xs text-slate-400 mt-1">Waybill: {order.shipment.delhiveryWaybill}</p>}
            </div>
          )}

          {(order.status === 'PAID' || order.status === 'PROCESSING') && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
              <h2 className="font-heading font-bold text-sm text-slate-900 mb-3">Packaging</h2>
              {order.status === 'PAID' && (
                <button
                  onClick={startPackaging}
                  disabled={updateStatus.isPending}
                  className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#9C5A26] hover:bg-[#6B3D19] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Start Packaging
                </button>
              )}
              {order.status === 'PROCESSING' && (
                <button
                  onClick={markPackagingDone}
                  disabled={updateStatus.isPending}
                  className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#9C5A26] hover:bg-[#6B3D19] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Mark Packaging Done
                </button>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
            <h2 className="font-heading font-bold text-sm text-slate-900 mb-3">Override Status</h2>
            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={s === order.status}
                  onClick={() => setPendingStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingStatus}
        title="Change Order Status"
        message={`Set this order's status to ${pendingStatus}? This writes to the order's status history.`}
        onConfirm={confirmStatusChange}
        onCancel={() => setPendingStatus(null)}
      />
    </>
  );
}
