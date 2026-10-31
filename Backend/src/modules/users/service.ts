import { normalizePhone } from '../../shared/utils/phone';
import { db } from '../../shared/db/client';

// Rows here are phone-keyed accounts: either created by OTP login or by a guest checkout
// (see findOrCreateGuestUser) — identity is the phone number either way.
export async function listUsers(query: { q?: string; page: number; limit: number }) {
  // Phone is stored normalized (+91XXXXXXXXXX); strip separators so "99515 52047" still matches.
  const digits = query.q?.replace(/[\s-]/g, '');
  const where = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' as const } },
          ...(digits ? [{ phone: { contains: digits } }] : []),
        ],
      }
    : {};

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

// A validly-signed JWT can outlive its user row (DB reset, deleted account). Checkout must
// not trust the token's `sub` blindly or Order.userId breaks the foreign key.
export async function userExists(id: string): Promise<boolean> {
  const row = await db.user.findUnique({ where: { id }, select: { id: true } });
  return row !== null;
}

// Guest checkout: no OTP at purchase time. The account is keyed by the phone number typed at
// checkout and created on first order; a later phone-OTP login attaches to this same row, so
// the customer then sees/tracks every order placed under that number. upsert (not
// find-then-create) so two simultaneous first orders can't collide on the unique phone.
export async function findOrCreateGuestUser(rawPhone: string) {
  const phone = normalizePhone(rawPhone);
  return db.user.upsert({ where: { phone }, update: {}, create: { phone } });
}
