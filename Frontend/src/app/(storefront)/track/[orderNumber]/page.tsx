import { notFound } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle2, Package, Truck, Home, MapPin, Phone, Download, ExternalLink, Wallet, XCircle, RotateCcw } from 'lucide-react';
import { api, invoiceUrl } from '@/lib/api-client';
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

// The 4-stop happy-path journey shown as a stepper — PROCESSING and PACKED both
// count as "Packed" so the stepper doesn't grow past what a shopper cares about.
const STEPS = [
  { key: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'PACKED', label: 'Packed', icon: Package },
  { key: 'SHIPPED', label: 'Shipped', icon: Truck },
  { key: 'DELIVERED', label: 'Delivered', icon: Home },
] as const;

const EXCEPTION_STATUS: Record<string, { label: string; icon: typeof XCircle; tone: string }> = {
  CANCELLED: { label: 'This order was cancelled', icon: XCircle, tone: 'text-brand-alert border-brand-alert/30 bg-brand-alert/5' },
  RETURN_REQUESTED: { label: 'Return requested — we’ll pick this up soon', icon: RotateCcw, tone: 'text-[#9C5A26] border-[#9C5A26]/30 bg-[#9C5A26]/5' },
  REFUNDED: { label: 'This order was refunded', icon: RotateCcw, tone: 'text-[#6B5539] border-[#2B1B0C]/15 bg-[#2B1B0C]/[0.03]' },
};

function stepIndexForStatus(status: string): number {
  switch (status) {
    case 'PENDING_PAYMENT':
      return -1;
    case 'PAID':
      return 0;
    case 'PROCESSING':
      return 0;
    case 'PACKED':
      return 1;
    case 'SHIPPED':
      return 2;
    case 'DELIVERED':
      return 3;
    default:
      return -1;
  }
}

function StatusStepper({ status }: { status: string }) {
  const activeIndex = stepIndexForStatus(status);

  return (
    <div className="flex items-start">
      {STEPS.map((step, i) => {
        const done = i <= activeIndex;
        const isCurrent = i === activeIndex;
        const Icon = step.icon;
        return (
          <div key={step.key} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  done
                    ? 'bg-[#9C5A26] border-[#2B1B0C] text-white'
                    : 'bg-white border-[#2B1B0C]/20 text-[#8A7A63]'
                } ${isCurrent ? 'ring-4 ring-[#9C5A26]/20' : ''}`}
              >
                <Icon className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </div>
              <span
                className={`font-body text-[10px] sm:text-xs font-bold uppercase tracking-wide text-center whitespace-nowrap ${
                  done ? 'text-[#2B1B0C]' : 'text-[#8A7A63]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 sm:mx-2 mt-4 sm:mt-5 rounded-full ${i < activeIndex ? 'bg-[#9C5A26]' : 'bg-[#2B1B0C]/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ItemAttributes({ attributes }: { attributes?: Record<string, unknown> }) {
  if (!attributes) return null;
  const label = Object.values(attributes).filter((v) => typeof v === 'string').join(' / ');
  if (!label) return null;
  return <p className="font-body text-xs text-[#8A7A63] mt-0.5">{label}</p>;
}

export default async function TrackOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const order = await getOrder(orderNumber);
  if (!order) notFound();

  const exception = EXCEPTION_STATUS[order.status];
  const address = order.shippingAddress;
  const events = [...(order.shipment?.trackingEvents ?? [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-heading font-black tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-1">
            Order {order.orderNumber}
          </h1>
          <p className="font-body text-xs text-[#8A7A63]">
            Placed on {formatDate(order.createdAt)} &middot; {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </p>
        </div>
        {order.payment?.status === 'CAPTURED' && (
          <a
            href={invoiceUrl(order.orderNumber)}
            className="flex items-center gap-1.5 border border-[#2B1B0C] rounded-full px-4 py-2 font-body font-bold text-xs uppercase tracking-wide text-[#2B1B0C] hover:bg-[#2B1B0C] hover:text-white transition-colors flex-shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Invoice
          </a>
        )}
      </div>

      {/* Status — either the happy-path stepper, or a clear exception banner */}
      <div className="bg-white border border-[#2B1B0C] rounded-2xl p-5 sm:p-6 mb-6">
        {exception ? (
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${exception.tone}`}>
            <exception.icon className="w-5 h-5 flex-shrink-0" />
            <p className="font-body font-bold text-sm">{exception.label}</p>
          </div>
        ) : (
          <>
            <StatusStepper status={order.status} />
            <p className="font-body text-xs text-[#6B5539] mt-5 text-center sm:text-left">
              Current status:{' '}
              <span className="font-bold text-[#2B1B0C]">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
              {order.shipment?.estimatedDelivery && (
                <> &middot; Estimated delivery {formatDate(order.shipment.estimatedDelivery)}</>
              )}
            </p>
          </>
        )}

        {order.shipment?.delhiveryWaybill && (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[#2B1B0C]/10">
            <p className="font-body text-xs text-[#6B5539]">
              Waybill: <span className="font-bold text-[#2B1B0C]">{order.shipment.delhiveryWaybill}</span>
            </p>
            <a
              href={`https://www.delhivery.com/track/package/${order.shipment.delhiveryWaybill}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-body text-xs font-bold text-[#9C5A26] hover:text-[#2B1B0C] transition-colors"
            >
              Track with courier <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {events.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#2B1B0C]/10 flex flex-col gap-3">
            {events.map((event, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center pt-1 flex-shrink-0">
                  <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-[#9C5A26]' : 'bg-[#2B1B0C]/20'}`} />
                  {i < events.length - 1 && <div className="w-px flex-1 bg-[#2B1B0C]/10 my-1" />}
                </div>
                <div className="pb-1">
                  <p className="font-body text-xs font-bold text-[#2B1B0C]">{event.description || event.status}</p>
                  <p className="font-body text-[10px] text-[#8A7A63] mt-0.5">
                    {formatDate(event.timestamp)}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-[1.4fr_1fr] gap-6">
        <div className="flex flex-col gap-6">
          {/* Items */}
          <div className="bg-white border border-[#2B1B0C] rounded-2xl p-5 sm:p-6">
            <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-4">Items</h2>
            <div className="flex flex-col gap-4">
              {order.items.map((item, i) => {
                const thumb = item.variant?.product?.images?.[0]?.thumb;
                return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-lg bg-[#F6E4C2] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {thumb ? (
                      <Image src={thumb} alt="" width={44} height={44} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-4 h-4 text-[#9C5A26]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-semibold text-[#2B1B0C] truncate">
                      {item.variantSnapshot.productName}
                    </p>
                    <ItemAttributes attributes={item.variantSnapshot.attributes} />
                    <p className="font-body text-xs text-[#8A7A63] mt-0.5">Qty {item.quantity}</p>
                  </div>
                  <span className="font-body text-sm font-semibold text-[#2B1B0C] flex-shrink-0">
                    {formatCurrency(item.priceAtPurchase * item.quantity)}
                  </span>
                </div>
                );
              })}
            </div>
          </div>

          {/* Delivery address */}
          <div className="bg-white border border-[#2B1B0C] rounded-2xl p-5 sm:p-6">
            <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#9C5A26]" />
              Delivery Address
            </h2>
            <p className="font-body text-sm font-semibold text-[#2B1B0C]">{order.customerName}</p>
            <p className="font-body text-sm text-[#6B5539] mt-1 leading-relaxed">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.state} {address.pincode}
            </p>
            <p className="font-body text-xs text-[#8A7A63] mt-2 flex items-center gap-1.5">
              <Phone className="w-3 h-3" />
              +91 {order.customerPhone.replace(/^\+91/, '')}
            </p>
          </div>
        </div>

        {/* Price summary */}
        <div className="bg-white border border-[#2B1B0C] rounded-2xl p-5 sm:p-6 h-fit sm:sticky sm:top-20">
          <h2 className="font-heading font-bold text-sm uppercase tracking-wide text-[#2B1B0C] mb-4">Price Details</h2>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between font-body text-sm text-[#6B5539]">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between font-body text-sm text-[#6B5539]">
              <span>Shipping</span>
              <span>{order.shippingFee === 0 ? 'Free' : formatCurrency(order.shippingFee)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between font-body text-sm text-[#9C5A26] font-semibold">
                <span>Discount</span>
                <span>&minus;{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            {order.walletRedeemed > 0 && (
              <div className="flex justify-between font-body text-sm text-[#9C5A26] font-semibold">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  Wallet Redeemed
                </span>
                <span>&minus;{formatCurrency(order.walletRedeemed)}</span>
              </div>
            )}
            <div className="flex justify-between font-heading font-bold text-lg text-[#2B1B0C] pt-3 border-t border-[#2B1B0C]/10">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
