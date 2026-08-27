'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import type { Banner, ProductImage } from '@/types/api.types';

const inputClass = 'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

export function BannerForm({
  banner,
  submitLabel,
  submitting,
  onSubmit,
}: {
  banner?: Banner;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: { image: ProductImage; link: string; order: number; isActive: boolean }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<ProductImage | null>(banner?.image ?? null);
  const [uploading, setUploading] = useState(false);
  const [link, setLink] = useState(banner?.link ?? '');
  const [order, setOrder] = useState(banner?.order ?? 0);
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await api.upload<ProductImage>('/api/admin/upload', formData);
      setImage(uploaded);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.error : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!image) return toast.error('Upload a banner image first');
    if (!link.trim()) return toast.error('Link is required');
    onSubmit({ image, link: link.trim(), order, isActive });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Banner Image</label>
        {image ? (
          <div className="relative w-full aspect-[21/9] rounded-lg overflow-hidden border border-slate-200 mb-2">
            <Image src={image.full} alt="" fill className="object-cover" />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-500 hover:border-[#9C5A26] transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : image ? 'Replace image' : 'Upload image'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Link (where clicking the banner goes)</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="/shop?purpose=love or https://..."
          className={`${inputClass} w-full`}
        />
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Display Order</label>
          <input
            type="number"
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className={`${inputClass} w-full`}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mt-5">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
          Active
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
