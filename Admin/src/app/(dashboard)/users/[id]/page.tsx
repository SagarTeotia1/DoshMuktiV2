'use client';

import { useParams, useRouter } from 'next/navigation';
import { Topbar } from '@/components/layout/Topbar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { ShoppingBag, Wallet } from 'lucide-react';
import { useUser } from '@/hooks/use-users';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: user, isLoading } = useUser(id);

  if (isLoading) return <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>;
  if (!user) return <p className="text-sm text-slate-400 py-8 text-center">User not found.</p>;

  return (
    <>
      <Topbar title={user.name ?? user.phone} />
      <div className="p-6 flex flex-col gap-6">
        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5 flex flex-col gap-1">
          <p className="text-lg font-bold text-slate-900">{user.phone}</p>
          <p className="text-sm text-slate-500">{user.name ?? 'No name on file'}</p>
          <p className="text-xs text-slate-400 mt-1">Signed up {formatDate(user.createdAt)}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Orders Placed" value={String(user.orderCount)} icon={ShoppingBag} />
          <StatCard label="Total Spent" value={formatCurrency(user.totalSpent)} icon={Wallet} />
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {user.orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No orders yet
                  </td>
                </tr>
              )}
              {user.orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-semibold text-slate-700">{o.orderNumber}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{o.payment?.status ?? '—'}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(o.total)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
