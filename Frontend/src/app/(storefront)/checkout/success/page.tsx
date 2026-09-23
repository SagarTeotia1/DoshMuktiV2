import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { api, invoiceUrl } from '@/lib/api-client';
import { PurchaseTracker } from '@/components/storefront/PurchaseTracker';
import type { OrderTrackingResponse } from '@/types/api.types';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOrder(orderNumber: string): Promise<OrderTrackingResponse | null> {
  try {
    return await api.get<OrderTrackingResponse>(`/api/orders/${orderNumber}`, undefined, 0);
  } catch {
    return null;
  }
}

// /api/checkout/verify (fired from the checkout page's Razorpay handler) is awaited
// before the redirect here, so payment.status is normally already CAPTURED by the time
// this renders — but that call swallows its own errors silently (network blip, cold
// Neon connection, transient 5xx), and the webhook backstop that would otherwise catch
// it is fragile in this deployment. A single fetch here previously meant: miss that
// narrow window and the Purchase conversion (GA4 + Meta Pixel) never fires for that
// order, ever — no second chance, since PurchaseTracker only ever mounts once off this
// server-rendered gate. Retrying a few times over ~6s catches the transient case without
// meaningfully delaying the page for the common case (already CAPTURED on the first try).
async function getOrderWithRetry(orderNumber: string): Promise<OrderTrackingResponse | null> {
  let order = await getOrder(orderNumber);
  for (let attempt = 0; attempt < 4 && order?.payment?.status !== 'CAPTURED'; attempt++) {
    await sleep(1500);
    order = await getOrder(orderNumber);
  }
  return order;
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
  const order = orderNumber ? await getOrderWithRetry(orderNumber) : null;
  const invoiceEligible = order?.payment?.status === 'CAPTURED';

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      {/* Only reports a Purchase conversion once the order is confirmed CAPTURED server-side
          — never on a payment Razorpay reported as successful but that failed verification
          or was later cancelled/refunded. See PurchaseTracker's comment for the full history. */}
      {invoiceEligible && order && (
        <PurchaseTracker
          orderNumber={order.orderNumber}
          total={order.total}
          itemCount={order.items.length}
        />
      )}
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
