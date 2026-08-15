'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Search, Trash2, X } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProductStatusBadge } from '@/components/ui/StatusBadge';
import { useProducts, useDeleteProduct } from '@/hooks/use-products';
import { formatCurrency } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import type { Product } from '@/types/api.types';

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const { data, isLoading } = useProducts(status || undefined, PAGE_SIZE, page, debouncedSearch || undefined);
  const deleteProduct = useDeleteProduct();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  function handleStatusChange(s: string) {
    setStatus(s);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteProduct.mutate(deleteTarget.id, {
      onSuccess: () => toast.success(`"${deleteTarget.name}" deleted`),
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to delete product'),
      onSettled: () => setDeleteTarget(null),
    });
  }

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'category', header: 'Category' },
      { accessorKey: 'basePrice', header: 'Price', cell: ({ row }) => formatCurrency(row.original.basePrice) },
      { id: 'variants', header: 'Variants', cell: ({ row }) => row.original.variants.length },
      { id: 'status', header: 'Status', cell: ({ row }) => <ProductStatusBadge status={row.original.status} /> },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row.original);
            }}
            title="Delete"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ),
      },
    ],
    []
  );

  return (
    <>
      <Topbar title="Products" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {['', 'DRAFT', 'ACTIVE', 'ARCHIVED'].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  status === s ? 'bg-[#9C5A26] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, category, or SKU..."
                className="w-72 pl-9 pr-8 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#9C5A26]/30 focus:border-[#9C5A26]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Link
              href="/products/new"
              className="flex items-center gap-1.5 bg-[#9C5A26] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#6B3D19] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Product
            </Link>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : (
          <>
            <DataTable data={data?.products ?? []} columns={columns} onRowClick={(p) => router.push(`/products/${p.id}`)} />

            {data && data.pages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">
                  Page {data.page} of {data.pages} &middot; {data.total} products
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    disabled={page >= data.pages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete product?"
        message={`"${deleteTarget?.name}" will be permanently removed and immediately disappear from the storefront. This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
