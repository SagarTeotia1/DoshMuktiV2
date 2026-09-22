'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useOrders } from '@/hooks/use-orders';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ORDER_STATUSES } from '@/lib/constants';
import type { Order } from '@/types/api.types';

// Default lower bound for the admin orders list — orders before this date are hidden
// unless the admin explicitly clears/changes the "From" filter. Nothing is deleted or
// hard-hidden server-side; this is purely a UI default (see Backend's from/to query params).
const DEFAULT_FROM_DATE = '2026-09-13';

const columns: ColumnDef<Order, unknown>[] = [
  { accessorKey: 'orderNumber', header: 'Order #' },
  { accessorKey: 'customerName', header: 'Customer' },
  { accessorKey: 'customerPhone', header: 'Phone' },
  {
    id: 'loginStatus',
    header: 'Account',
    cell: ({ row }) => (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          row.original.userId ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {row.original.userId ? 'Logged in' : 'Guest'}
      </span>
    ),
  },
  { accessorKey: 'total', header: 'Total', cell: ({ row }) => formatCurrency(row.original.total) },
  {
    id: 'deliveryCost',
    header: 'Delivery Cost',
    cell: ({ row }) => {
      const cost = row.original.actualShippingCost;
      return cost === null ? <span className="text-slate-400">—</span> : formatCurrency(cost);
    },
  },
  { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  {
    id: 'risk',
    header: 'Risk',
    cell: ({ row }) => {
      const flag = row.original.shipment?.riskFlag;
      if (!flag) return null;
      return (
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            flag === 'BAD_ADDRESS' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {flag === 'BAD_ADDRESS' ? 'Bad Address' : 'High Risk'}
        </span>
      );
    },
  },
  { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => formatDate(row.original.createdAt) },
];

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400 py-8 text-center">Loading...</p>}>
      <OrdersPageContent />
    </Suspense>
  );
}

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  // "from" defaults to DEFAULT_FROM_DATE only when the URL doesn't already specify one —
  // this is a UI default, not a hard block: the admin can clear/change it to see any date.
  const [from, setFrom] = useState(searchParams.get('from') ?? DEFAULT_FROM_DATE);
  const [to, setTo] = useState(searchParams.get('to') ?? '');
  const { data, isLoading } = useOrders(status || undefined, { from: from || undefined, to: to || undefined });

  return (
    <>
      <Topbar title="Orders" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatus('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !status ? 'bg-[#9C5A26] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All
          </button>
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                status === s ? 'bg-[#9C5A26] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
            />
          </div>
          {(from || to) && (
            <button
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Clear dates
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : (
          <DataTable data={data?.orders ?? []} columns={columns} onRowClick={(o) => router.push(`/orders/${o.id}`)} />
        )}
      </div>
    </>
  );
}
