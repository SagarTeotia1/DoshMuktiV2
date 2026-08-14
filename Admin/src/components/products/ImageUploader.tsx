'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { useUpdateProduct } from '@/hooks/use-products';
import type { Product } from '@/types/api.types';

export function ImageUploader({ product }: { product: Product }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const updateProduct = useUpdateProduct(product.id);
  const current = product.images ?? [];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      // Upload sequentially, then merge and PATCH once — parallel/multiple
      // mutate() calls each read the same stale `current` array closure and
      // last-write-wins, silently dropping all but one uploaded image.
      const uploaded: { thumb: string; card: string; full: string }[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        uploaded.push(await api.upload<{ thumb: string; card: string; full: string }>('/api/admin/upload', formData));
      }
      updateProduct.mutate(
        { images: [...current, ...uploaded] },
        {
          onSuccess: () => toast.success(uploaded.length > 1 ? `${uploaded.length} images uploaded` : 'Image uploaded'),
          onError: () => toast.error('Failed to save image to product'),
        }
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.error : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeImage(index: number) {
    const updated = current.filter((_, i) => i !== index);
    updateProduct.mutate({ images: updated });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4">
      <h2 className="font-heading font-bold text-sm text-slate-900 mb-3">Images</h2>
      <div className="flex flex-wrap gap-3">
        {current.map((img, i) => (
          <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 group">
            <Image src={img.thumb} alt="" fill className="object-cover" />
            <button
              onClick={() => removeImage(i)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        ))}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center hover:border-[#9C5A26] transition-colors disabled:opacity-50"
        >
          <Upload className="w-4 h-4 text-slate-400" />
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}
