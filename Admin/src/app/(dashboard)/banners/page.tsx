'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Drawer } from '@/components/ui/Drawer';
import { BannerForm } from '@/components/banners/BannerForm';
import { useBanners, useCreateBanner, useUpdateBanner, useDeleteBanner } from '@/hooks/use-banners';
import { ApiError } from '@/lib/api-client';
import type { Banner } from '@/types/api.types';

type DrawerState = { mode: 'create' } | { mode: 'edit'; banner: Banner } | null;

export default function BannersPage() {
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Banner | null>(null);

  const { data, isLoading } = useBanners();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();

  function handleCreate(values: Parameters<typeof createBanner.mutate>[0]) {
    createBanner.mutate(values, {
      onSuccess: () => {
        toast.success('Banner created');
        setDrawer(null);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to create banner'),
    });
  }

  function handleUpdate(id: string, values: Parameters<typeof updateBanner.mutate>[0]['input']) {
    updateBanner.mutate(
      { id, input: values },
      {
        onSuccess: () => {
          toast.success('Banner updated');
          setDrawer(null);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update banner'),
      }
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteBanner.mutate(deleteTarget.id, {
      onSuccess: () => toast.success('Banner deleted'),
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to delete banner'),
      onSettled: () => setDeleteTarget(null),
    });
  }

  function toggleActive(banner: Banner) {
    updateBanner.mutate(
      { id: banner.id, input: { isActive: !banner.isActive } },
      { onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update banner') }
    );
  }

  const columns = useMemo<ColumnDef<Banner, unknown>[]>(
    () => [
      {
        id: 'image',
        header: 'Preview',
        cell: ({ row }) => (
          <div className="relative w-24 h-10 rounded-md overflow-hidden border border-slate-200">
            <Image src={row.original.image.thumb} alt="" fill className="object-cover" />
          </div>
        ),
      },
      {
        accessorKey: 'link',
        header: 'Link',
        cell: ({ row }) => <span className="text-slate-600 text-sm">{row.original.link}</span>,
      },
      {
        accessorKey: 'order',
        header: 'Order',
        cell: ({ row }) => <span className="text-slate-500">{row.original.order}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <button
            onClick={() => toggleActive(row.original)}
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full transition-colors ${
              row.original.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {row.original.isActive ? 'Active' : 'Inactive'}
          </button>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              onClick={() => setDrawer({ mode: 'edit', banner: row.original })}
              title="Edit"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget(row.original)}
              title="Delete"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <>
      <Topbar title="Banners" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-end">
          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="flex items-center gap-1.5 bg-[#9C5A26] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#6B3D19] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Banner
          </button>
        </div>

        {isLoading ? <p className="text-sm text-slate-400 py-8 text-center">Loading...</p> : <DataTable data={data ?? []} columns={columns} />}
      </div>

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer?.mode === 'edit' ? 'Edit Banner' : 'Add Banner'}>
        {drawer !== null && (
          <BannerForm
            key={drawer.mode === 'edit' ? drawer.banner.id : 'create'}
            banner={drawer.mode === 'edit' ? drawer.banner : undefined}
            submitLabel={drawer.mode === 'edit' ? 'Save Changes' : 'Add Banner'}
            submitting={createBanner.isPending || updateBanner.isPending}
            onSubmit={(values) => (drawer.mode === 'edit' ? handleUpdate(drawer.banner.id, values) : handleCreate(values))}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete banner?"
        message="This banner will stop showing on the storefront immediately. This can't be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
