'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import type { Category, ProductImage } from '@/types/api.types';

const inputClass = 'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

export function CategoryForm({
  category,
  submitLabel,
  submitting,
  onSubmit,
}: {
  category?: Category;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: { name: string; stripLabel: string | null; image: ProductImage | null; order: number; isActive: boolean }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(category?.name ?? '');
  const [stripLabel, setStripLabel] = useState(category?.stripLabel ?? '');
  const [image, setImage] = useState<ProductImage | null>(category?.image ?? null);
  const [uploading, setUploading] = useState(false);
  const [order, setOrder] = useState(category?.order ?? 0);
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  // What the storefront will actually show right now.
  const preview = image ?? category?.fallbackImage ?? null;
  const renaming = category !== undefined && name.trim() !== category.name;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      setImage(await api.upload<ProductImage>('/api/admin/upload', formData));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.error : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    onSubmit({ name: name.trim(), stripLabel: stripLabel.trim() || null, image, order, isActive });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bracelets" className={`${inputClass} w-full`} />
        {renaming && (
          <p className="text-xs text-amber-600 mt-1">
            Renaming updates all {category.productCount} product{category.productCount === 1 ? '' : 's'} and any category offers using it.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Homepage strip name <span className="font-normal text-slate-400">(optional — short label under the circle; blank = first word of the name)</span>
        </label>
        <input
          value={stripLabel}
          onChange={(e) => setStripLabel(e.target.value)}
          maxLength={40}
          placeholder={name.trim().split(/[\s/]+/)[0] || 'e.g. Car Perfume'}
          className={`${inputClass} w-full`}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
          Image <span className="font-normal text-slate-400">(optional — otherwise the latest active product&apos;s photo is used)</span>
        </label>
        {preview ? (
          <div className="relative w-28 h-28 rounded-full overflow-hidden border border-slate-200 mb-2">
            <Image src={preview.card} alt="" fill className="object-cover" sizes="112px" />
          </div>
        ) : null}
        {!image && preview ? <p className="text-xs text-slate-400 mb-2">Showing latest product photo (automatic).</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-500 hover:border-[#9C5A26] transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : image ? 'Replace image' : 'Upload image'}
          </button>
          {image ? (
            <button
              type="button"
              onClick={() => setImage(null)}
              className="px-3 rounded-lg border border-slate-300 text-sm text-slate-500 hover:border-red-400 hover:text-red-600 transition-colors"
            >
              Use latest product
            </button>
          ) : null}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Order</label>
          <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className={`${inputClass} w-full`} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mt-5">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
          Show on storefront
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting || uploading}
        className="bg-[#9C5A26] text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-[#6B3D19] transition-colors disabled:opacity-50 mt-2"
      >
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
