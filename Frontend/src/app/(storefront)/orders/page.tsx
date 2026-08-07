'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PackageSearch, FileDown } from 'lucide-react';
import { api, invoiceUrl } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import type { OrderTrackingResponse } from '@/types/api.types';

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<OrderTrackingResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/orders');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get<OrderTrackingResponse[]>('/api/orders/mine', { Authorization: `Bearer ${getToken()}` }, 0)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated || loading) {
    return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center font-body text-sm text-[#8A7A63]">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-heading font-black tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-1.5">
        Your Orders
      </h1>
      <p className="font-body text-sm text-[#8A7A63] mb-8">
        {user ? `Signed in as ${user.name}, +91 ${user.phone.replace(/^\+91/, '')}` : ''}
      </p>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 border border-dashed border-[#2B1B0C]/20 rounded-2xl">
          <PackageSearch className="w-8 h-8 text-[#9C5A26] mb-3" strokeWidth={1.5} />
          <p className="font-body text-sm text-[#6B5539]">No orders yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const invoiceEligible = order.payment?.status === 'CAPTURED';
            return (
              <div
                key={order.orderNumber}
                className="relative bg-white border border-[#2B1B0C] rounded-2xl p-4 sm:p-5 hover:shadow-neo-md transition-shadow duration-200"
              >
                {/* Stretched link — makes the whole card navigate to /track, while the
                    invoice icon below stays independently clickable via its own z-10
                    (avoids nesting an <a> inside a <Link>, which is invalid HTML). */}
                <Link
                  href={`/track/${order.orderNumber}`}
                  className="absolute inset-0"
                  aria-label={`Track order ${order.orderNumber}`}
                />
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-heading font-bold text-sm text-[#2B1B0C]">{order.orderNumber}</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block bg-[#9C5A26] text-[#2B1B0C] border border-[#2B1B0C] rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider font-body whitespace-nowrap">
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    {invoiceEligible && (
                      <a
                        href={invoiceUrl(order.orderNumber)}
                        aria-label={`Download invoice for order ${order.orderNumber}`}
                        title="Download Invoice"
                        className="relative z-10 text-[#8A7A63] hover:text-[#9C5A26] transition-colors duration-200"
                      >
                        <FileDown className="w-4 h-4" strokeWidth={2} />
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <p className="font-body text-xs text-[#8A7A63] mb-1">
                    {order.items.length} item{order.items.length === 1 ? '' : 's'} · Placed {formatDate(order.createdAt)}
                  </p>
                  <p className="font-heading font-bold text-base text-[#2B1B0C]">{formatCurrency(order.total)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
