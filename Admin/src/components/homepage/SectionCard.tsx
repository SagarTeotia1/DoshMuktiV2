'use client';

import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import { useSetHomepageSectionItems } from '@/hooks/use-homepage-sections';
import { ProductPicker } from './ProductPicker';
import type { AdminHomepageSection } from '@/types/api.types';

export function SectionCard({
  section,
  isFirst,
  isLast,
  onMoveSection,
  onRename,
  onToggleActive,
  onDelete,
}: {
  section: AdminHomepageSection;
  isFirst: boolean;
  isLast: boolean;
  onMoveSection: (direction: 'up' | 'down') => void;
  onRename: (title: string) => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(section.title);

  const setItems = useSetHomepageSectionItems();

  const sortedItems = [...section.items].sort((a, b) => a.order - b.order);

  function saveTitle() {
    if (!titleDraft.trim()) {
      toast.error('Title cannot be empty');
      return;
    }
    onRename(titleDraft.trim());
    setEditingTitle(false);
  }

  function cancelTitle() {
    setTitleDraft(section.title);
    setEditingTitle(false);
  }

  function persistItems(productIds: string[], successMessage?: string) {
    setItems.mutate(
      { id: section.id, productIds },
      {
        onSuccess: () => {
          if (successMessage) toast.success(successMessage);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update section products'),
      }
    );
  }

  function moveItem(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedItems.length) return;
    const ids = sortedItems.map((it) => it.product.id);
    const tmp = ids[index]!;
    ids[index] = ids[targetIndex]!;
    ids[targetIndex] = tmp;
    persistItems(ids);
  }

  function removeItem(productId: string) {
    const ids = sortedItems.filter((it) => it.product.id !== productId).map((it) => it.product.id);
    persistItems(ids, 'Product removed from section');
  }

  function addItem(productId: string) {
    const ids = [...sortedItems.map((it) => it.product.id), productId];
    persistItems(ids, 'Product added to section');
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex flex-col">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMoveSection('up')}
            title="Move section up"
            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:hover:text-slate-400 transition-colors"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMoveSection('down')}
            title="Move section down"
            className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:hover:text-slate-400 transition-colors"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') cancelTitle();
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-semibold focus:ring-2 focus:ring-[#9C5A26] focus:outline-none w-full max-w-sm"
              />
              <button onClick={saveTitle} title="Save" className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={cancelTitle} title="Cancel" className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-slate-900 truncate">{section.title}</span>
              <button
                onClick={() => {
                  setTitleDraft(section.title);
                  setEditingTitle(true);
                }}
                title="Rename"
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-slate-400">
                {section.key} &middot; {sortedItems.length} product{sortedItems.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleActive}
          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full transition-colors ${
            section.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {section.isActive ? 'Active' : 'Inactive'}
        </button>

        <button
          type="button"
          onClick={onDelete}
          title="Delete section"
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 flex flex-col gap-3 bg-slate-50/50">
          {sortedItems.length === 0 ? (
            <p className="text-sm text-slate-400">No products in this section yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sortedItems.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2"
                >
                  <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                  <div className="relative w-10 h-10 rounded-md bg-slate-100 border border-slate-200 shrink-0 overflow-hidden">
                    {item.product.images?.[0] && (
                      <Image src={item.product.images[0].thumb} alt="" fill className="object-cover" />
                    )}
                  </div>
                  <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{item.product.name}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(index, 'up')}
                      title="Move up"
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:hover:text-slate-400 transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sortedItems.length - 1}
                      onClick={() => moveItem(index, 'down')}
                      title="Move down"
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:hover:text-slate-400 transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      title="Remove from section"
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-1">
            <ProductPicker
              excludeIds={sortedItems.map((it) => it.product.id)}
              onPick={(product) => addItem(product.id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
