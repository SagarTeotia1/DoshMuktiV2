'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Drawer } from '@/components/ui/Drawer';
import { CouponForm } from '@/components/coupons/CouponForm';
import {
  useCoupons,
  useCreateCoupon,
  useUpdateCoupon,
  type CreateCouponInput,
  type UpdateCouponInput,
} from '@/hooks/use-coupons';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import type { Coupon, CouponType } from '@/types/api.types';

const PAGE_SIZE = 20;

const TYPE_LABEL: Record<CouponType, string> = { FLAT: 'Flat', PERCENT: 'Percent', BIRTHDAY: 'Birthday' };

const TYPE_BADGE: Record<CouponType, string> = {
  FLAT: 'bg-[#9C5A26]/10 text-[#6B3D19]',
  PERCENT: 'bg-[#9C5A26]/10 text-[#6B3D19]',
  BIRTHDAY: 'bg-indigo-50 text-indigo-700',
};

function valueText(coupon: Coupon): string {
  return coupon.type === 'FLAT' ? formatCurrency(coupon.value) : `${coupon.value}%`;
}

function usageText(coupon: Coupon): string {
  return `${coupon.usedCount} / ${coupon.maxUses ?? '∞'}`;
}

function expiryText(coupon: Coupon): string {
  return coupon.expiresAt ? formatDate(coupon.expiresAt) : 'Never';
}

function offerLinkText(coupon: Coupon): string {
  if (coupon.offerCount === 0) return '—';
  return `${coupon.offerCount} offer${coupon.offerCount === 1 ? '' : 's'}`;
}

const inputClass = 'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

type DrawerState = { mode: 'create' } | { mode: 'edit'; coupon: Coupon } | null;

export default function CouponsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | ''>('');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [archiveTarget, setArchiveTarget] = useState<Coupon | null>(null);

  const { data, isLoading } = useCoupons({
    search: search || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function handleCreate(values: CreateCouponInput | UpdateCouponInput) {
    createCoupon.mutate(values as CreateCouponInput, {
      onSuccess: () => {
        toast.success('Coupon created');
        setDrawer(null);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to create coupon'),
    });
  }

  function handleUpdate(id: string, values: CreateCouponInput | UpdateCouponInput) {
    updateCoupon.mutate(
      { id, input: values },
      {
        onSuccess: () => {
          toast.success('Coupon updated');
          setDrawer(null);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update coupon'),
      }
    );
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    updateCoupon.mutate(
      { id: archiveTarget.id, input: { isActive: false } },
      {
        onSuccess: () => toast.success('Coupon archived'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to archive coupon'),
        onSettled: () => setArchiveTarget(null),
      }
    );
  }

  function restore(coupon: Coupon) {
    updateCoupon.mutate(
      { id: coupon.id, input: { isActive: true } },
      {
        onSuccess: () => toast.success('Coupon restored'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to restore coupon'),
      }
    );
  }

  const columns = useMemo<ColumnDef<Coupon, unknown>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Code',
        cell: ({ row }) => (
          <span className={row.original.isActive ? 'font-semibold text-slate-900' : 'font-semibold text-slate-400 line-through'}>
            {row.original.code}
          </span>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${TYPE_BADGE[row.original.type]}`}>
            {TYPE_LABEL[row.original.type]}
          </span>
        ),
      },
      {
        id: 'value',
        header: 'Value',
        cell: ({ row }) => <span className="text-slate-600">{valueText(row.original)}</span>,
      },
      {
        id: 'usage',
        header: 'Usage',
        cell: ({ row }) => <span className="text-slate-600">{usageText(row.original)}</span>,
      },
      {
        id: 'expiry',
        header: 'Expiry',
        cell: ({ row }) => <span className="text-slate-500">{expiryText(row.original)}</span>,
      },
      {
        id: 'offerCount',
        header: 'Linked Offers',
        cell: ({ row }) => <span className="text-slate-500">{offerLinkText(row.original)}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              row.original.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {row.original.isActive ? 'Active' : 'Archived'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const coupon = row.original;
          return (
            <div className="flex items-center gap-1 justify-end">
              <button
                type="button"
                onClick={() => setDrawer({ mode: 'edit', coupon })}
                title="Edit"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {coupon.isActive ? (
                <button
                  type="button"
                  onClick={() => setArchiveTarget(coupon)}
                  title="Archive"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => restore(coupon)}
                  title="Restore"
                  className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                >
                  <ArchiveRestore className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <>
      <Topbar title="Coupons" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by code..."
              className={`${inputClass} w-56`}
            />
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value as 'active' | 'archived' | '');
              }}
              className={inputClass}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="flex items-center gap-1.5 bg-[#9C5A26] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#6B3D19] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Coupon
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : (
          <>
            <DataTable data={data?.coupons ?? []} columns={columns} />

            {data && data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>
                  Page {page} of {totalPages} — {data.total} coupons
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer?.mode === 'edit' ? 'Edit Coupon' : 'Create Coupon'}>
        {drawer !== null && (
          <CouponForm
            key={drawer.mode === 'edit' ? drawer.coupon.id : 'create'}
            coupon={drawer.mode === 'edit' ? drawer.coupon : undefined}
            submitLabel={drawer.mode === 'edit' ? 'Save Changes' : 'Create Coupon'}
            submitting={createCoupon.isPending || updateCoupon.isPending}
            onSubmit={(values) => (drawer.mode === 'edit' ? handleUpdate(drawer.coupon.id, values) : handleCreate(values))}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive coupon?"
        message={`"${archiveTarget?.code}" will no longer be redeemable at checkout. You can restore it later.`}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
