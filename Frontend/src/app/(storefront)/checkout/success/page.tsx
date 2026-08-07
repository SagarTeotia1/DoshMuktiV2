import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { api, invoiceUrl } from '@/lib/api-client';
import type { OrderTrackingResponse } from '@/types/api.types';

async function getOrder(orderNumber: string): Promise<OrderTrackingResponse | null> {
  try {
    return await api.get<OrderTrackingResponse>(`/api/orders/${orderNumber}`, undefined, 0);
  } catch {
    return null;
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNumber?: string }>;
}) {
  const { orderNumber } = await searchParams;
  // Payment confirmation (POST /api/checkout/verify, fired from the checkout page's Razorpay
  // handler) is best-effort and can still be in flight when this page renders — gate the
  // invoice link on the order's actual payment status rather than showing a link that's
  // likely to 409 on the very first click.
  const order = orderNumber ? await getOrder(orderNumber) : null;
  const invoiceEligible = order?.payment?.status === 'CAPTURED';

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <CheckCircle2 className="w-16 h-16 text-[#9C5A26] mx-auto mb-6" />
      <h1 className="font-heading font-black tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-3">Order Confirmed</h1>
      {orderNumber && (
        <p className="font-body text-sm text-[#6B5539] mb-1">
          Order <span className="font-bold text-[#2B1B0C]">{orderNumber}</span>
        </p>
      )}
      <p className="font-body text-sm text-[#8A7A63] mb-8">
        Thank you for your order. We&apos;ve sent a confirmation to your email/WhatsApp.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {orderNumber && (
          <Link
            href={`/track/${orderNumber}`}
            className="bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200"
          >
            Track Order
          </Link>
        )}
        {invoiceEligible && (
          <a
            href={invoiceUrl(orderNumber!)}
            className="bg-white text-[#2B1B0C] border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#F6E4C2] transition-all duration-200"
          >
            Download Invoice
          </a>
        )}
        <Link
          href="/shop"
          className="bg-white text-[#2B1B0C] border border-[#2B1B0C] rounded-full px-8 py-4 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#F6E4C2] transition-all duration-200"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
