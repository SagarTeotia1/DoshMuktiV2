import { db } from '../../shared/db/client';
import { sendOrderConfirmation } from '../../shared/integrations/resend/client';
import { createShipment } from '../../shared/integrations/delhivery/client';
import { creditCashbackForOrder } from '../wallet/service';
import { releaseCouponUsageTx } from '../coupons/service';
import { invalidateProductCaches } from '../products/service';

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

  // Credited on PAID rather than DELIVERED — simpler, matches this store's guest-checkout
  // trust model. Cheap DB writes, safe to await inline (unlike the network calls below).
  await creditCashbackForOrder(payment.orderId);

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

// A payment.failed webhook means this order is definitively dead — not just
// "not yet paid" like a still-in-progress checkout. Previously this only flipped
// Payment to FAILED and left the Order sitting in PENDING_PAYMENT indefinitely
// (reserved stock held, coupon slot held), relying on the release-holds cron to
// eventually notice once reservedUntil passed — so a real failure looked
// indistinguishable from a live in-progress order in Admin for up to
// RESERVATION_MINUTES. Now it releases the reservation immediately, same
// atomic/append-only rules as release-holds.ts.
export async function handlePaymentFailed(razorpayOrderId: string, reason: string): Promise<void> {
  const updated: number = await db.$executeRaw`
    UPDATE "Payment" SET status = 'FAILED', "failureReason" = ${reason}
    WHERE "razorpayOrderId" = ${razorpayOrderId} AND status = 'PENDING'
  `;
  if (updated === 0) return; // already processed

  const payment = await db.payment.findUnique({
    where: { razorpayOrderId },
    include: { order: { include: { items: true } } },
  });
  if (!payment) return;

  const order = payment.order;

  await db.$transaction(async (tx) => {
    // Idempotent: only an order still PENDING_PAYMENT gets cancelled/released —
    // guards against a replayed webhook or a race with the release-holds sweep
    // double-releasing the same stock.
    const cancelled: number = await tx.$executeRaw`
      UPDATE "Order" SET status = 'CANCELLED', "updatedAt" = NOW()
      WHERE id = ${order.id} AND status = 'PENDING_PAYMENT'
    `;
    if (cancelled === 0) return;

    for (const item of order.items) {
      await tx.$executeRaw`
        UPDATE "ProductVariant" SET "stockQuantity" = "stockQuantity" + ${item.quantity} WHERE id = ${item.variantId}
      `;
      await tx.stockMovement.create({
        data: { variantId: item.variantId, change: item.quantity, reason: 'RESERVATION_RELEASED', orderId: order.id, createdBy: 'system' },
      });
    }

    if (order.couponId) {
      await releaseCouponUsageTx(tx, order.couponId);
    }

    await tx.orderStatusLog.create({
      data: { orderId: order.id, from: 'PENDING_PAYMENT', to: 'CANCELLED', createdBy: 'system', note: `Payment failed: ${reason}` },
    });
  });

  await invalidateProductCaches();
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
