import { db } from '../../shared/db/client';

interface LowStockCountRow {
  count: bigint;
}

export async function getDashboardSummary() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [todayOrders, actionNeeded, lowStockRows] = await Promise.all([
    db.order.findMany({
      where: { status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: startOfDay } },
      select: { total: true },
    }),
    db.order.count({ where: { status: 'PAID' } }),
    db.$queryRaw<LowStockCountRow[]>`
      SELECT COUNT(*) as count FROM "ProductVariant"
      WHERE "isActive" = true AND "stockQuantity" <= "lowStockThreshold"
    `,
  ]);

  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);

  return {
    todayOrderCount: todayOrders.length,
    todayRevenue,
    ordersNeedingAction: actionNeeded,
    lowStockCount: Number(lowStockRows[0]?.count ?? 0),
  };
}

interface DailySalesRow {
  day: Date;
  revenue: string;
  orderCount: bigint;
}

export async function getSalesTrend(days: number) {
  const rows = await db.$queryRaw<DailySalesRow[]>`
    SELECT date_trunc('day', "createdAt") as day,
           COALESCE(SUM(total), 0) as revenue,
           COUNT(*) as "orderCount"
    FROM "Order"
    WHERE "createdAt" >= NOW() - (${days} || ' days')::interval
      AND status IN ('PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED')
    GROUP BY day
    ORDER BY day ASC
  `;

  return rows.map((r) => ({
    date: r.day.toISOString().slice(0, 10),
    revenue: Number(r.revenue),
    orderCount: Number(r.orderCount),
  }));
}
