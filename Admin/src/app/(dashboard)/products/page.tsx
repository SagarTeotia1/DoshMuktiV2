'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/ui/DataTable';
import { ProductStatusBadge } from '@/components/ui/StatusBadge';
import { useProducts } from '@/hooks/use-products';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types/api.types';

const columns: ColumnDef<Product, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'category', header: 'Category' },
  { accessorKey: 'basePrice', header: 'Price', cell: ({ row }) => formatCurrency(row.original.basePrice) },
  { id: 'variants', header: 'Variants', cell: ({ row }) => row.original.variants.length },
  { id: 'status', header: 'Status', cell: ({ row }) => <ProductStatusBadge status={row.original.status} /> },
];

export default function ProductsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const { data, isLoading } = useProducts(status || undefined);

  return (
    <>
      <Topbar title="Products" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {['', 'DRAFT', 'ACTIVE', 'ARCHIVED'].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  status === s ? 'bg-[#9C5A26] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          <Link
            href="/products/new"
            className="flex items-center gap-1.5 bg-[#9C5A26] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#6B3D19] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Product
          </Link>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : (
          <DataTable data={data?.products ?? []} columns={columns} onRowClick={(p) => router.push(`/products/${p.id}`)} />
        )}
      </div>
    </>
  );
}
