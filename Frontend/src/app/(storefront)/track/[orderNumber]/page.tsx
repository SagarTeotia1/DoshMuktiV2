import { notFound } from 'next/navigation';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import type { OrderTrackingResponse } from '@/types/api.types';

async function getOrder(orderNumber: string): Promise<OrderTrackingResponse | null> {
  try {
    return await api.get<OrderTrackingResponse>(`/api/orders/${orderNumber}`, undefined, 0);
  } catch {
    return null;
  }
}

export default async function TrackOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await getOrder(orderNumber);
  if (!order) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-heading font-black tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-1">Order {order.orderNumber}</h1>
      <p className="font-body text-xs text-[#8A7A63] mb-6">Placed on {formatDate(order.createdAt)}</p>

      <div className="bg-white border border-[#2B1B0C] rounded-2xl p-6 mb-6">
        <span className="inline-block bg-[#9C5A26] text-[#2B1B0C] border border-[#2B1B0C] rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider font-body">
          {ORDER_STATUS_LABELS[order.status] ?? order.status}
        </span>

        {order.shipment?.delhiveryWaybill && (
          <p className="font-body text-xs text-[#6B5539] mt-3">
            Waybill: <span className="font-bold text-[#2B1B0C]">{order.shipment.delhiveryWaybill}</span>
          </p>
        )}
      </div>

      <div className="bg-white border border-[#2B1B0C] rounded-2xl p-6 flex flex-col gap-3">
        <h2 className="font-heading font-bold text-lg text-[#2B1B0C] mb-1">Items</h2>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between font-body text-sm text-[#6B5539]">
            <span>
              {item.variantSnapshot.productName} × {item.quantity}
            </span>
            <span>{formatCurrency(item.priceAtPurchase * item.quantity)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
