'use client';

import Link from 'next/link';
import { IndianRupee, ShoppingBag, AlertTriangle, PackageX } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { StatCard } from '@/components/ui/StatCard';
import { SalesChart } from '@/components/charts/SalesChart';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatCurrency } from '@/lib/utils';

export default function DashboardPage() {
  const { summary, sales } = useDashboard();

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="p-6 flex flex-col gap-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Today's Revenue" value={summary.data ? formatCurrency(summary.data.todayRevenue) : '—'} icon={IndianRupee} />
          <StatCard label="Today's Orders" value={summary.data?.todayOrderCount ?? '—'} icon={ShoppingBag} />
          <StatCard label="Needs Packing" value={summary.data?.ordersNeedingAction ?? '—'} icon={AlertTriangle} tone="warning" />
          <StatCard label="Low Stock Items" value={summary.data?.lowStockCount ?? '—'} icon={PackageX} tone="danger" />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
          <h2 className="font-heading font-bold text-sm text-slate-900 mb-4">Revenue — Last 30 Days</h2>
          {sales.data && <SalesChart data={sales.data} />}
        </div>

        {summary.data && summary.data.ordersNeedingAction > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm text-amber-800">
              <strong>{summary.data.ordersNeedingAction}</strong> order(s) are paid and waiting to be packed.
            </p>
            <Link href="/orders?status=PAID" className="text-xs font-bold uppercase tracking-wider text-amber-700 hover:text-amber-900">
              View Orders →
            </Link>
          </div>
        )}

        {summary.data && summary.data.lowStockCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <p className="text-sm text-red-800">
              <strong>{summary.data.lowStockCount}</strong> variant(s) are at or below their stock threshold.
            </p>
            <Link href="/inventory" className="text-xs font-bold uppercase tracking-wider text-red-700 hover:text-red-900">
              View Inventory →
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
