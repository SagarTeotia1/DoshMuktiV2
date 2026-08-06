'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Copy, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Drawer } from '@/components/ui/Drawer';
import { OfferForm } from '@/components/offers/OfferForm';
import {
  useOffers,
  useCreateOffer,
  useUpdateOffer,
  useDuplicateOffer,
  type CreateOfferInput,
  type UpdateOfferInput,
} from '@/hooks/use-offers';
import { formatDate } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import type { Offer, OfferBehavior, OfferReward, OfferScope } from '@/types/api.types';

const PAGE_SIZE = 20;

const BEHAVIOR_OPTIONS: Array<{ value: OfferBehavior; label: string }> = [
  { value: 'DISPLAY_ONLY', label: 'Display Only' },
  { value: 'AUTO_APPLIED', label: 'Auto Applied' },
  { value: 'COUPON_BASED', label: 'Coupon Based' },
];

const REWARD_OPTIONS: Array<{ value: OfferReward; label: string }> = [
  { value: 'DISPLAY_MESSAGE', label: 'Display Message' },
  { value: 'PERCENTAGE_DISCOUNT', label: 'Percentage Discount' },
  { value: 'FLAT_DISCOUNT', label: 'Flat Discount' },
  { value: 'CASHBACK', label: 'Cashback' },
  { value: 'FREE_GIFT', label: 'Free Gift' },
  { value: 'BUY_X_GET_Y', label: 'Buy X Get Y' },
  { value: 'FREE_SHIPPING', label: 'Free Shipping' },
];

const BEHAVIOR_BADGE: Record<OfferBehavior, string> = {
  DISPLAY_ONLY: 'bg-slate-100 text-slate-600',
  AUTO_APPLIED: 'bg-emerald-50 text-emerald-700',
  COUPON_BASED: 'bg-blue-50 text-blue-700',
};

const REWARD_BADGE: Record<OfferReward, string> = {
  DISPLAY_MESSAGE: 'bg-slate-100 text-slate-600',
  PERCENTAGE_DISCOUNT: 'bg-[#9C5A26]/10 text-[#6B3D19]',
  FLAT_DISCOUNT: 'bg-[#9C5A26]/10 text-[#6B3D19]',
  CASHBACK: 'bg-amber-50 text-amber-700',
  FREE_GIFT: 'bg-emerald-50 text-emerald-700',
  BUY_X_GET_Y: 'bg-indigo-50 text-indigo-700',
  FREE_SHIPPING: 'bg-sky-50 text-sky-700',
};

const SCOPE_OPTIONS: Array<{ value: OfferScope; label: string }> = [
  { value: 'SPECIFIC_PRODUCTS', label: 'Specific Products' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'ALL_PRODUCTS', label: 'All Products' },
];

const SCOPE_BADGE: Record<OfferScope, string> = {
  SPECIFIC_PRODUCTS: 'bg-slate-100 text-slate-600',
  CATEGORY: 'bg-violet-50 text-violet-700',
  ALL_PRODUCTS: 'bg-rose-50 text-rose-700',
};

const behaviorLabel = (b: OfferBehavior) => BEHAVIOR_OPTIONS.find((o) => o.value === b)?.label ?? b;
const rewardLabel = (r: OfferReward) => REWARD_OPTIONS.find((o) => o.value === r)?.label ?? r;
const scopeLabel = (s: OfferScope) => SCOPE_OPTIONS.find((o) => o.value === s)?.label ?? s;

function productUsageText(offer: Offer): string {
  if (offer.scope === 'ALL_PRODUCTS') return `All ${offer.productCount} products`;
  if (offer.scope === 'CATEGORY') return `${offer.productCount} in ${offer.category}`;
  return `Used on ${offer.productCount} products`;
}

const inputClass = 'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

type DrawerState = { mode: 'create' } | { mode: 'edit'; offer: Offer } | null;

export default function OffersPage() {
  const [search, setSearch] = useState('');
  const [behavior, setBehavior] = useState<OfferBehavior | ''>('');
  const [reward, setReward] = useState<OfferReward | ''>('');
  const [status, setStatus] = useState<'active' | 'archived' | ''>('');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [archiveTarget, setArchiveTarget] = useState<Offer | null>(null);

  const { data, isLoading } = useOffers({
    search: search || undefined,
    behavior: behavior || undefined,
    reward: reward || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const createOffer = useCreateOffer();
  const updateOffer = useUpdateOffer();
  const duplicateOffer = useDuplicateOffer();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function handleCreate(values: CreateOfferInput | UpdateOfferInput) {
    createOffer.mutate(values as CreateOfferInput, {
      onSuccess: () => {
        toast.success('Offer created');
        setDrawer(null);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to create offer'),
    });
  }

  function handleUpdate(id: string, values: CreateOfferInput | UpdateOfferInput) {
    updateOffer.mutate(
      { id, input: values },
      {
        onSuccess: () => {
          toast.success('Offer updated');
          setDrawer(null);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update offer'),
      }
    );
  }

  function handleDuplicate(offer: Offer) {
    duplicateOffer.mutate(offer.id, {
      onSuccess: (copy) => {
        toast.success('Offer duplicated — edit the copy below');
        setDrawer({ mode: 'edit', offer: copy });
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to duplicate offer'),
    });
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    updateOffer.mutate(
      { id: archiveTarget.id, input: { isActive: false } },
      {
        onSuccess: () => toast.success('Offer archived'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to archive offer'),
        onSettled: () => setArchiveTarget(null),
      }
    );
  }

  function restore(offer: Offer) {
    updateOffer.mutate(
      { id: offer.id, input: { isActive: true } },
      {
        onSuccess: () => toast.success('Offer restored'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to restore offer'),
      }
    );
  }

  const columns = useMemo<ColumnDef<Offer, unknown>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => (
          <span className={row.original.isActive ? 'font-semibold text-slate-900' : 'font-semibold text-slate-400 line-through'}>
            {row.original.title}
          </span>
        ),
      },
      {
        id: 'behavior',
        header: 'Behavior',
        cell: ({ row }) => (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${BEHAVIOR_BADGE[row.original.behavior]}`}>
            {behaviorLabel(row.original.behavior)}
          </span>
        ),
      },
      {
        id: 'reward',
        header: 'Reward',
        cell: ({ row }) => (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${REWARD_BADGE[row.original.reward]}`}>
            {rewardLabel(row.original.reward)}
          </span>
        ),
      },
      {
        id: 'scope',
        header: 'Scope',
        cell: ({ row }) => (
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${SCOPE_BADGE[row.original.scope]}`}>
            {scopeLabel(row.original.scope)}
          </span>
        ),
      },
      {
        id: 'productCount',
        header: 'Product Usage',
        cell: ({ row }) => <span className="text-slate-600">{productUsageText(row.original)}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => <span className="text-slate-500">{formatDate(row.original.createdAt)}</span>,
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
          const offer = row.original;
          return (
            <div className="flex items-center gap-1 justify-end">
              <button
                type="button"
                onClick={() => setDrawer({ mode: 'edit', offer })}
                title="Edit"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDuplicate(offer)}
                title="Duplicate"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
              {offer.isActive ? (
                <button
                  type="button"
                  onClick={() => setArchiveTarget(offer)}
                  title="Archive"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => restore(offer)}
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
      <Topbar title="Offers" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by title..."
              className={`${inputClass} w-56`}
            />
            <select
              value={behavior}
              onChange={(e) => {
                setPage(1);
                setBehavior(e.target.value as OfferBehavior | '');
              }}
              className={inputClass}
            >
              <option value="">All behaviors</option>
              {BEHAVIOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={reward}
              onChange={(e) => {
                setPage(1);
                setReward(e.target.value as OfferReward | '');
              }}
              className={inputClass}
            >
              <option value="">All rewards</option>
              {REWARD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
            Create Offer
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : (
          <>
            <DataTable data={data?.offers ?? []} columns={columns} />

            {data && data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>
                  Page {page} of {totalPages} — {data.total} offers
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

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer?.mode === 'edit' ? 'Edit Offer' : 'Create Offer'}>
        {drawer !== null && (
          <OfferForm
            key={drawer.mode === 'edit' ? drawer.offer.id : 'create'}
            offer={drawer.mode === 'edit' ? drawer.offer : undefined}
            submitLabel={drawer.mode === 'edit' ? 'Save Changes' : 'Create Offer'}
            submitting={createOffer.isPending || updateOffer.isPending}
            onSubmit={(values) => (drawer.mode === 'edit' ? handleUpdate(drawer.offer.id, values) : handleCreate(values))}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archive offer?"
        message={`"${archiveTarget?.title}" will stop showing on any product it's linked to. You can restore it later.`}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </>
  );
}
