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
import { CategoryForm } from '@/components/categories/CategoryForm';
import { useCategoryList, useCreateCategory, useUpdateCategory, useDeleteCategory } from '@/hooks/use-category-admin';
import { ApiError } from '@/lib/api-client';
import type { Category } from '@/types/api.types';

type DrawerState = { mode: 'create' } | { mode: 'edit'; category: Category } | null;

export default function CategoriesPage() {
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data, isLoading } = useCategoryList();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const errorMessage = (err: unknown, fallback: string) => (err instanceof ApiError ? err.body.error : fallback);

  function handleCreate(values: Parameters<typeof createCategory.mutate>[0]) {
    createCategory.mutate(values, {
      onSuccess: () => {
        toast.success('Category created');
        setDrawer(null);
      },
      onError: (err) => toast.error(errorMessage(err, 'Failed to create category')),
    });
  }

  function handleUpdate(id: string, values: Parameters<typeof updateCategory.mutate>[0]['input']) {
    updateCategory.mutate(
      { id, input: values },
      {
        onSuccess: () => {
          toast.success('Category updated');
          setDrawer(null);
        },
        onError: (err) => toast.error(errorMessage(err, 'Failed to update category')),
      }
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteCategory.mutate(deleteTarget.id, {
      onSuccess: () => toast.success('Category deleted'),
      onError: (err) => toast.error(errorMessage(err, 'Failed to delete category')),
      onSettled: () => setDeleteTarget(null),
    });
  }

  function toggleActive(category: Category) {
    updateCategory.mutate(
      { id: category.id, input: { isActive: !category.isActive } },
      { onError: (err) => toast.error(errorMessage(err, 'Failed to update category')) }
    );
  }

  const columns = useMemo<ColumnDef<Category, unknown>[]>(
    () => [
      {
        id: 'image',
        header: 'Image',
        cell: ({ row }) => {
          const img = row.original.image ?? row.original.fallbackImage;
          return (
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100">
              {img ? <Image src={img.thumb} alt="" fill className="object-cover" sizes="40px" /> : null}
            </div>
          );
        },
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-800">{row.original.name}</span>
            {!row.original.image && row.original.fallbackImage ? (
              <span className="text-[11px] text-slate-400">image: latest product (auto)</span>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'productCount',
        header: 'Products',
        cell: ({ row }) => <span className="text-slate-500">{row.original.productCount}</span>,
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
            {row.original.isActive ? 'Visible' : 'Hidden'}
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
              onClick={() => setDrawer({ mode: 'edit', category: row.original })}
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
      <Topbar title="Categories" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            These drive the homepage category strip, shop filters and the product form. A category only shows on the storefront once it has an active product.
          </p>
          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="flex items-center gap-1.5 bg-[#9C5A26] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#6B3D19] transition-colors flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>

        {isLoading ? <p className="text-sm text-slate-400 py-8 text-center">Loading...</p> : <DataTable data={data ?? []} columns={columns} />}
      </div>

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer?.mode === 'edit' ? 'Edit Category' : 'Add Category'}>
        {drawer !== null && (
          <CategoryForm
            key={drawer.mode === 'edit' ? drawer.category.id : 'create'}
            category={drawer.mode === 'edit' ? drawer.category : undefined}
            submitLabel={drawer.mode === 'edit' ? 'Save Changes' : 'Add Category'}
            submitting={createCategory.isPending || updateCategory.isPending}
            onSubmit={(values) => (drawer.mode === 'edit' ? handleUpdate(drawer.category.id, values) : handleCreate(values))}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete category?"
        message={
          deleteTarget && deleteTarget.productCount > 0
            ? `"${deleteTarget.name}" still has ${deleteTarget.productCount} product(s) — deletion will be refused. Hide it instead, or move the products first.`
            : `Delete "${deleteTarget?.name ?? ''}"? This can't be undone.`
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
