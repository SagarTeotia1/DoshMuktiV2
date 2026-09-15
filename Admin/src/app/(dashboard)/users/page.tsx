'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Search } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/ui/DataTable';
import { useUsers } from '@/hooks/use-users';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { AdminUser } from '@/types/api.types';

const columns: ColumnDef<AdminUser, unknown>[] = [
  { accessorKey: 'phone', header: 'Phone' },
  { id: 'name', header: 'Name', cell: ({ row }) => row.original.name ?? <span className="text-slate-400">—</span> },
  { accessorKey: 'orderCount', header: 'Orders' },
  { id: 'totalSpent', header: 'Total Spent', cell: ({ row }) => formatCurrency(row.original.totalSpent) },
  { accessorKey: 'createdAt', header: 'Signed Up', cell: ({ row }) => formatDate(row.original.createdAt) },
];

export default function UsersPage() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const { data, isLoading } = useUsers(phone || undefined);

  return (
    <>
      <Topbar title="Users" />
      <div className="p-6 flex flex-col gap-4">
        {/* Every row here is a real phone+OTP account — login is OTP-only (no
            password), guest checkouts never create one of these. */}
        <p className="text-sm text-slate-500">Customers who have logged in via phone number + OTP.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPhone(phoneInput.trim());
          }}
          className="flex flex-col sm:flex-row gap-2 sm:items-center bg-white border border-slate-200 rounded-lg shadow-card p-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Search by phone number"
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#9C5A26] text-white text-sm font-semibold hover:bg-[#8A4E20] transition-colors"
          >
            Search
          </button>
          {phone && (
            <button
              type="button"
              onClick={() => {
                setPhoneInput('');
                setPhone('');
              }}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:border-slate-400 transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : (
          <DataTable data={data?.users ?? []} columns={columns} onRowClick={(u) => router.push(`/users/${u.id}`)} />
        )}
      </div>
    </>
  );
}
