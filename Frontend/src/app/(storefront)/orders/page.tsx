'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { PackageSearch, FileDown, ChevronRight, Package } from 'lucide-react';
import { api, invoiceUrl } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/lib/constants';
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
    return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center font-body text-sm text-[#8A7A63]">Loading...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-heading font-black tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-1.5">
        Your Orders
      </h1>
      <p className="font-body text-sm text-[#8A7A63] mb-8">
        {user ? `Signed in as ${user.name}, +91 ${user.phone.replace(/^\+91/, '')}` : ''}
      </p>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 border border-dashed border-[#2B1B0C]/20 rounded-2xl">
          <PackageSearch className="w-8 h-8 text-[#9C5A26] mb-3" strokeWidth={1.5} />
          <p className="font-body text-sm text-[#6B5539] mb-4">No orders yet.</p>
          <Link
            href="/shop"
            className="font-body text-xs font-bold uppercase tracking-wide text-white bg-[#2B1B0C] rounded-full px-6 py-2.5 hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-colors"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const invoiceEligible = order.payment?.status === 'CAPTURED';
            const firstItem = order.items[0];
            const thumb = firstItem?.variant?.product?.images?.[0]?.thumb;
            const extraCount = order.items.length - 1;
            const tone = ORDER_STATUS_TONE[order.status] ?? 'bg-[#9C5A26] text-white border-[#2B1B0C]';

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

                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#F6E4C2] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {thumb ? (
                      <Image src={thumb} alt="" width={80} height={80} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-[#9C5A26]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-body text-sm font-semibold text-[#2B1B0C] truncate">
                          {firstItem?.variantSnapshot.productName ?? 'Order'}
                          {extraCount > 0 ? ` + ${extraCount} more` : ''}
                        </p>
                        <p className="font-body text-xs text-[#8A7A63] mt-0.5">
                          {order.orderNumber} · Placed {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`flex-shrink-0 inline-block rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider font-body whitespace-nowrap ${tone}`}
                      >
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[#2B1B0C]/8">
                      <p className="font-heading font-bold text-base text-[#2B1B0C]">{formatCurrency(order.total)}</p>
                      <div className="flex items-center gap-3">
                        {invoiceEligible && (
                          <a
                            href={invoiceUrl(order.orderNumber)}
                            aria-label={`Download invoice for order ${order.orderNumber}`}
                            title="Download Invoice"
                            className="relative z-10 flex items-center gap-1 font-body text-xs font-bold text-[#8A7A63] hover:text-[#9C5A26] transition-colors duration-200"
                          >
                            <FileDown className="w-3.5 h-3.5" strokeWidth={2} />
                            <span className="hidden sm:inline">Invoice</span>
                          </a>
                        )}
                        <span className="flex items-center gap-0.5 font-body text-xs font-bold text-[#9C5A26]">
                          Track <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
