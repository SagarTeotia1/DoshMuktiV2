import { db } from '../../shared/db/client';
import type { OrderStatus } from '@prisma/client';

// Order/product images so the storefront's order pages can show real thumbnails
// (Amazon/Flipkart-style) instead of a generic icon per line item.
const itemsWithProductImage = { items: { include: { variant: { include: { product: true } } } } } as const;

export async function getOrderByNumber(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    include: { ...itemsWithProductImage, payment: true, shipment: true },
  });
}

export async function listOrdersForUser(userId: string) {
  return db.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: { ...itemsWithProductImage, payment: true, shipment: true },
  });
}

export async function listOrdersByPhone(phone: string) {
  return db.order.findMany({
    where: { customerPhone: phone },
    orderBy: { createdAt: 'desc' },
    include: { ...itemsWithProductImage, payment: true, shipment: true },
  });
}

export async function getOrderById(id: string) {
  return db.order.findUnique({
    where: { id },
    include: { items: { include: { variant: true } }, payment: true, shipment: true, statusLog: { orderBy: { createdAt: 'desc' } } },
  });
}

export async function listOrdersForAdmin(query: { status?: OrderStatus; page: number; limit: number }) {
  const where = query.status ? { status: query.status } : {};
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { items: true, payment: true, shipment: true },
    }),
    db.order.count({ where }),
  ]);
  return { orders, total, pages: Math.ceil(total / query.limit), page: query.page };
}

type GstVariantSnapshot = { sku?: string; productName?: string; gstRate?: number | null };

// GST is an inclusive breakup of amounts already charged (see invoice.ts's identical
// formula) — purely a reporting computation for the CA, never touches order pricing/total.
function computeItemGst(lineTotal: number, gstRate: number): { taxableValue: number; gstAmount: number } {
  const taxableValue = lineTotal / (1 + gstRate / 100);
  return { taxableValue, gstAmount: lineTotal - taxableValue };
}

export interface GstReportItemRow {
  sku: string;
  productName: string;
  quantity: number;
  gstRate: number;
  lineTotal: number;
  taxableValue: number;
  gstAmount: number;
}

export interface GstReportOrderRow {
  orderNumber: string;
  orderDate: string;
  items: GstReportItemRow[];
  orderTaxableValue: number;
  orderGstAmount: number;
}

export interface GstReport {
  from: string;
  to: string;
  orders: GstReportOrderRow[];
  totalTaxableValue: number;
  totalGstAmount: number;
}

// Every order in [from, to] (inclusive, by createdAt) with at least one item whose
// variantSnapshot.gstRate is a set number — orders with no GST-rated items are omitted
// entirely rather than showing as zero rows.
export async function getGstReport(from: string, to: string): Promise<GstReport> {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);

  const orders = await db.order.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate } },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  });

  const reportOrders: GstReportOrderRow[] = [];
  let totalTaxableValue = 0;
  let totalGstAmount = 0;

  for (const order of orders) {
    const itemRows: GstReportItemRow[] = [];
    let orderTaxableValue = 0;
    let orderGstAmount = 0;

    for (const item of order.items) {
      const snapshot = item.variantSnapshot as unknown as GstVariantSnapshot;
      const gstRate = typeof snapshot.gstRate === 'number' ? snapshot.gstRate : null;
      if (gstRate === null) continue;

      const lineTotal = Number(item.priceAtPurchase) * item.quantity;
      const { taxableValue, gstAmount } = computeItemGst(lineTotal, gstRate);
      itemRows.push({
        sku: snapshot.sku ?? '-',
        productName: snapshot.productName ?? '-',
        quantity: item.quantity,
        gstRate,
        lineTotal,
        taxableValue,
        gstAmount,
      });
      orderTaxableValue += taxableValue;
      orderGstAmount += gstAmount;
    }

    if (itemRows.length === 0) continue;

    reportOrders.push({
      orderNumber: order.orderNumber,
      orderDate: order.createdAt.toISOString(),
      items: itemRows,
      orderTaxableValue,
      orderGstAmount,
    });
    totalTaxableValue += orderTaxableValue;
    totalGstAmount += orderGstAmount;
  }

  return { from, to, orders: reportOrders, totalTaxableValue, totalGstAmount };
}

export async function updateOrderStatus(orderId: string, newStatus: OrderStatus, note: string | undefined, admin: string) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
    await tx.orderStatusLog.create({
      data: { orderId, from: order.status, to: newStatus, note, createdBy: admin },
    });
    return updated;
  });
}
