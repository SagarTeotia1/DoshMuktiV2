import { cn, formatCurrency } from '@/lib/utils';
import type { Order } from '@/types/api.types';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/lib/constants';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', ORDER_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700')}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function ProductStatusBadge({ status }: { status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    ARCHIVED: 'bg-red-100 text-red-700',
  };
  return <span className={cn('inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', map[status])}>{status}</span>;
}

type PaymentBadgeOrder = Pick<Order, 'paymentMethod' | 'codAdvanceAmount' | 'codAmountDue' | 'status'> & {
  payment: { status: string } | null;
};

// "COD - PAID ₹100" + "₹900 due on delivery" (or "cash collected" once DELIVERED);
// "PREPAID - PAID" for online orders. Amounts arrive as Prisma Decimal strings.
export function PaymentBadge({ order }: { order: PaymentBadgeOrder }) {
  const paid = order.payment?.status === 'CAPTURED';
  const isCod = order.paymentMethod === 'COD';
  const tone = paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';

  const label = isCod
    ? `COD - ${paid ? `PAID ${formatCurrency(Number(order.codAdvanceAmount))}` : 'ADVANCE PENDING'}`
    : `PREPAID - ${paid ? 'PAID' : (order.payment?.status ?? 'PENDING')}`;

  const note = isCod && paid
    ? order.status === 'DELIVERED'
      ? 'Cash collected'
      : `${formatCurrency(Number(order.codAmountDue))} due on delivery`
    : null;

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={cn('inline-block w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', tone)}>{label}</span>
      {note && <span className="text-[11px] text-slate-500">{note}</span>}
    </span>
  );
}
