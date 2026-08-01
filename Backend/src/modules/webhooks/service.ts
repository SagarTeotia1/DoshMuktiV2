import { db } from '../../shared/db/client';
import { sendOrderConfirmation } from '../../shared/integrations/resend/client';
import { createShipment } from '../../shared/integrations/delhivery/client';

interface RazorpayShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export async function handlePaymentCaptured(razorpayOrderId: string, razorpayPaymentId: string): Promise<void> {
  // Idempotent: only rows still PENDING get updated — replayed webhooks are a no-op
  const updated: number = await db.$executeRaw`
    UPDATE "Payment" SET status = 'CAPTURED', "razorpayPaymentId" = ${razorpayPaymentId}, "verifiedAt" = NOW()
    WHERE "razorpayOrderId" = ${razorpayOrderId} AND status = 'PENDING'
  `;
  if (updated === 0) return;

  const payment = await db.payment.findUnique({
    where: { razorpayOrderId },
    include: { order: { include: { items: { include: { variant: true } } } } },
  });
  if (!payment) return;

  await db.order.update({
    where: { id: payment.orderId },
    data: {
      status: 'PAID',
      statusLog: { create: { from: 'PENDING_PAYMENT', to: 'PAID', createdBy: 'system' } },
    },
  });

  // Fire-and-forget — never block webhook response on email/shipment calls
  if (payment.order.customerEmail) {
    void sendOrderConfirmation(payment.order.customerEmail, payment.order.orderNumber, Number(payment.order.total));
  }
  const addr = payment.order.shippingAddress as unknown as RazorpayShippingAddress;
  void createShipment({
    orderNumber: payment.order.orderNumber,
    customerName: payment.order.customerName,
    customerPhone: payment.order.customerPhone,
    address: addr,
    totalAmount: Number(payment.order.total),
    weight: payment.order.items.reduce((sum, i) => sum + i.variant.weight * i.quantity, 0),
  }).then(async (shipment) => {
    if (shipment) {
      await db.shipment.create({ data: { orderId: payment.orderId, delhiveryWaybill: shipment.waybill, status: 'BOOKED' } });
    }
  });
}

export async function handlePaymentFailed(razorpayOrderId: string, reason: string): Promise<void> {
  const updated: number = await db.$executeRaw`
    UPDATE "Payment" SET status = 'FAILED', "failureReason" = ${reason}
    WHERE "razorpayOrderId" = ${razorpayOrderId} AND status = 'PENDING'
  `;
  if (updated === 0) return; // already processed
}

export async function handleDelhiveryStatusUpdate(waybill: string, event: { status: string; location: string; description: string; timestamp: string }): Promise<void> {
  const shipment = await db.shipment.findFirst({ where: { delhiveryWaybill: waybill } });
  if (!shipment) return;

  const events = (shipment.trackingEvents as unknown as Array<typeof event>) ?? [];
  events.push(event);

  await db.shipment.update({
    where: { id: shipment.id },
    data: { trackingEvents: events as unknown as object, status: mapDelhiveryStatus(event.status) },
  });
}

function mapDelhiveryStatus(status: string): 'PENDING' | 'BOOKED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED' {
  const map: Record<string, ReturnType<typeof mapDelhiveryStatus>> = {
    Manifested: 'BOOKED',
    'In Transit': 'IN_TRANSIT',
    'Out for Delivery': 'OUT_FOR_DELIVERY',
    Delivered: 'DELIVERED',
    Undelivered: 'FAILED',
    RTO: 'RETURNED',
  };
  return map[status] ?? 'IN_TRANSIT';
}
