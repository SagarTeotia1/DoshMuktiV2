import { cn } from '@/lib/utils';
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
