'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Drawer } from '@/components/ui/Drawer';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SectionCard } from '@/components/homepage/SectionCard';
import { NewSectionForm } from '@/components/homepage/NewSectionForm';
import {
  useHomepageSections,
  useCreateHomepageSection,
  useUpdateHomepageSection,
  useDeleteHomepageSection,
} from '@/hooks/use-homepage-sections';
import { ApiError } from '@/lib/api-client';
import type { AdminHomepageSection } from '@/types/api.types';

export default function HomepagePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminHomepageSection | null>(null);

  const { data, isLoading } = useHomepageSections();
  const createSection = useCreateHomepageSection();
  const updateSection = useUpdateHomepageSection();
  const deleteSection = useDeleteHomepageSection();

  const sections = [...(data ?? [])].sort((a, b) => a.order - b.order);

  function handleCreate(values: { key: string; title: string }) {
    createSection.mutate(values, {
      onSuccess: () => {
        toast.success('Section created');
        setDrawerOpen(false);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to create section'),
    });
  }

  function handleRename(section: AdminHomepageSection, title: string) {
    updateSection.mutate(
      { id: section.id, input: { title } },
      {
        onSuccess: () => toast.success('Section renamed'),
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to rename section'),
      }
    );
  }

  function handleToggleActive(section: AdminHomepageSection) {
    updateSection.mutate(
      { id: section.id, input: { isActive: !section.isActive } },
      { onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update section') }
    );
  }

  function handleMoveSection(section: AdminHomepageSection, direction: 'up' | 'down') {
    const index = sections.findIndex((s) => s.id === section.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const target = sections[targetIndex];
    if (!target) return;

    // Swap the two sections' `order` values with two PATCH calls.
    updateSection.mutate(
      { id: section.id, input: { order: target.order } },
      { onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to reorder sections') }
    );
    updateSection.mutate(
      { id: target.id, input: { order: section.order } },
      { onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to reorder sections') }
    );
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteSection.mutate(deleteTarget.id, {
      onSuccess: () => toast.success('Section deleted'),
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to delete section'),
      onSettled: () => setDeleteTarget(null),
    });
  }

  return (
    <>
      <Topbar title="Homepage" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center justify-end">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 bg-[#9C5A26] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#6B3D19] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Section
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : sections.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No homepage sections yet. Create one to get started.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sections.map((section, index) => (
              <SectionCard
                key={section.id}
                section={section}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
                onMoveSection={(direction) => handleMoveSection(section, direction)}
                onRename={(title) => handleRename(section, title)}
                onToggleActive={() => handleToggleActive(section)}
                onDelete={() => setDeleteTarget(section)}
              />
            ))}
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="New Homepage Section">
        <NewSectionForm submitting={createSection.isPending} onSubmit={handleCreate} />
      </Drawer>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete section?"
        message="This section and its product list will stop showing on the storefront homepage immediately. This can't be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
