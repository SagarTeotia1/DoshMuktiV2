'use client';

import { useRef, useState } from 'react';
import { useFieldArray, useController } from 'react-hook-form';
import { ArrowUp, ArrowDown, Type, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import type { DescriptionBlock } from '@/types/api.types';

const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

// Ordered, fully-custom product description editor — any mix/count of text and
// image blocks, in whatever order the admin arranges them (no fixed template).
// Lives inside ProductForm's own react-hook-form state via useFieldArray, same
// local-array-field pattern as `benefits`/`howToWear`, so it saves atomically
// with the rest of the form on submit rather than fighting an immediate-PATCH.
// `control` is intentionally untyped — react-hook-form's `Control<T>` generic doesn't
// contravariantly widen to `Control<any>` cleanly (a known RHF/TS variance quirk once
// the form shape has a union-typed field like `description`'s text|image blocks), and
// this component is meant to be reusable against any form's field array by name anyway.
export function DescriptionEditor({ control, name }: { control: any; name: string }) {
  const { fields, append, remove, move } = useFieldArray({ control, name });
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleAddImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      // Upload sequentially, append each as its own block once uploaded — mirrors
      // StagedImageUploader's upload-then-append pattern. No PATCH here at all:
      // blocks only join local form state until the form's own submit saves them.
      const uploaded: Extract<DescriptionBlock, { type: 'image' }>[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const img = await api.upload<{ thumb: string; card: string; full: string }>('/api/admin/upload', formData);
        uploaded.push({ type: 'image', ...img });
      }
      uploaded.forEach((block) => append(block));
      toast.success(uploaded.length > 1 ? `${uploaded.length} images added` : 'Image added');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.error : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && <p className="text-xs text-slate-400">No description blocks yet — add text or images below.</p>}

      {fields.map((field, i) => (
        <DescriptionBlockRow
          key={field.id}
          control={control}
          name={name}
          index={i}
          total={fields.length}
          onRemove={() => remove(i)}
          onMoveUp={() => move(i, i - 1)}
          onMoveDown={() => move(i, i + 1)}
        />
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => append({ type: 'text', content: '' } satisfies DescriptionBlock)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:border-[#9C5A26] hover:text-[#9C5A26] transition-colors"
        >
          <Type className="w-3.5 h-3.5" /> Add Text
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:border-[#9C5A26] hover:text-[#9C5A26] transition-colors disabled:opacity-50"
        >
          <ImageIcon className="w-3.5 h-3.5" /> {uploading ? 'Uploading...' : 'Add Image'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddImages} />
      </div>
    </div>
  );
}

function DescriptionBlockRow({
  control,
  name,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  control: any;
  name: string;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { field } = useController({ control, name: `${name}.${index}` });
  const block = field.value as DescriptionBlock;

  return (
    <div className="flex gap-2 items-start border border-slate-200 rounded-lg p-3 bg-slate-50/50">
      <div className="flex flex-col gap-1 pt-1 flex-shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 text-slate-400 hover:text-[#9C5A26] disabled:opacity-25 disabled:hover:text-slate-400 transition-colors"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-1 text-slate-400 hover:text-[#9C5A26] disabled:opacity-25 disabled:hover:text-slate-400 transition-colors"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-w-0">
        {block.type === 'text' ? (
          <textarea
            value={block.content}
            onChange={(e) => field.onChange({ ...block, content: e.target.value })}
            rows={3}
            placeholder="Paragraph text..."
            className={inputClass}
          />
        ) : (
          // Full-width preview at the image's own natural aspect ratio — this is what
          // actually ships on the product page, so a cropped corner thumbnail here would
          // mislead the admin about how the block will really look. Plain <img>, not
          // next/image, so an arbitrary uploaded aspect ratio never gets stretched to a
          // fixed width/height box. Uses `full` (aspect-preserved, `fit: 'inside'` at
          // upload) rather than `card` (hard-cropped to a 600x600 square server-side) —
          // `card` would still show a cropped image even inside an uncropped CSS box.
          <div className="w-full max-w-md rounded-lg overflow-hidden border border-slate-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={block.full} alt="" className="w-full h-auto block" />
          </div>
        )}
      </div>

      <button type="button" onClick={onRemove} className="p-2 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
