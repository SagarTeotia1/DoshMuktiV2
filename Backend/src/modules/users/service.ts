import { db } from '../../shared/db/client';

// Every row here is a real phone+OTP account (see User model — identity is the phone
// number, login is OTP-only). Guest checkouts never create a User row, so this list is
// exactly "who has actually logged in", never a superset that needs filtering.
export async function listUsers(query: { phone?: string; page: number; limit: number }) {
  const where = query.phone ? { phone: { contains: query.phone } } : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      // "Orders" here means actually-paid orders — a PENDING_PAYMENT/failed/abandoned
      // checkout attempt was never a real order the customer completed, so it must
      // never inflate the count they see. Same CAPTURED filter drives totalSpent below.
      include: {
        orders: { where: { payment: { status: 'CAPTURED' } }, select: { total: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  const rows = users.map((u) => {
    const { orders, ...rest } = u;
    const totalSpent = orders.reduce((sum, o) => sum + Number(o.total), 0);
    return { ...rest, orderCount: orders.length, totalSpent };
  });

  return { users: rows, total, pages: Math.ceil(total / query.limit), page: query.page };
}

export async function getUserById(id: string) {
  const user = await db.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        include: { payment: true },
      },
    },
  });
  if (!user) return null;

  // orderCount/totalSpent match listUsers' definition exactly: only orders whose
  // payment actually CAPTURED count as a real, paid order. The full order history
  // (every attempt, any status) still returns in `orders` for the detail table below —
  // only the summary numbers at the top of the page are restricted to paid ones.
  const paidOrders = user.orders.filter((o) => o.payment?.status === 'CAPTURED');
  const orderCount = paidOrders.length;
  const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

  return { ...user, orderCount, totalSpent };
}
