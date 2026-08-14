'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { useUpdateProduct } from '@/hooks/use-products';
import type { Product, TestimonialVideo } from '@/types/api.types';

// No video transcoding pipeline exists in Backend/src/modules/upload (image-only —
// see ALLOWED_MIME in upload/service.ts), so this doesn't accept video files. Admin
// pastes a direct hosted video URL and only the poster/thumbnail image goes through
// the existing image upload endpoint, same as ImageUploader.tsx.
export function TestimonialVideosUploader({ product }: { product: Product }) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const updateProduct = useUpdateProduct(product.id);
  const current = product.testimonialVideos ?? [];

  function save(updated: TestimonialVideo[], successMsg?: string) {
    updateProduct.mutate(
      { testimonialVideos: updated },
      {
        onSuccess: () => {
          if (successMsg) toast.success(successMsg);
        },
        onError: () => toast.error('Failed to save testimonial videos'),
      }
    );
  }

  function addVideo() {
    const next: TestimonialVideo = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `tv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      videoUrl: '',
      posterUrl: null,
      caption: '',
      views: '',
    };
    save([...current, next]);
  }

  function removeVideo(id: string) {
    save(current.filter((v) => v.id !== id));
  }

  function updateField(id: string, field: keyof TestimonialVideo, value: string) {
    save(current.map((v) => (v.id === id ? { ...v, [field]: value } : v)));
  }

  async function handlePosterFile(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploaded = await api.upload<{ thumb: string; card: string; full: string }>('/api/admin/upload', formData);
      save(
        current.map((v) => (v.id === id ? { ...v, posterUrl: uploaded.card } : v)),
        'Poster image uploaded'
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.error : 'Poster upload failed');
    } finally {
      setUploadingId(null);
      const input = inputRefs.current[id];
      if (input) input.value = '';
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-bold text-sm text-slate-900">Testimonial Videos</h2>
        <button
          onClick={addVideo}
          className="inline-flex items-center gap-1 text-xs font-medium text-[#9C5A26] hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          Add video
        </button>
      </div>

      {current.length === 0 ? (
        <p className="text-xs text-slate-400">No testimonial videos yet. Add one to show a &quot;Loved by customers&quot; row on the PDP.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {current.map((v) => (
            <div key={v.id} className="flex gap-3 border border-slate-200 rounded-lg p-3">
              <div className="relative w-16 h-28 shrink-0 rounded-md overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center">
                {v.posterUrl ? (
                  <Image src={v.posterUrl} alt="" fill className="object-cover" />
                ) : (
                  <span className="text-[10px] text-slate-400 text-center px-1">No poster</span>
                )}
                <button
                  onClick={() => inputRefs.current[v.id]?.click()}
                  disabled={uploadingId === v.id}
                  className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center disabled:opacity-50"
                  title="Upload poster image"
                >
                  <Upload className="w-4 h-4 text-white" />
                </button>
                <input
                  ref={(el) => {
                    inputRefs.current[v.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePosterFile(v.id, e)}
                />
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Video URL (mp4/webm)"
                  defaultValue={v.videoUrl}
                  onBlur={(e) => updateField(v.id, 'videoUrl', e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#9C5A26]"
                />
                <input
                  type="text"
                  placeholder="Caption"
                  defaultValue={v.caption}
                  onBlur={(e) => updateField(v.id, 'caption', e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#9C5A26]"
                />
                <input
                  type="text"
                  placeholder="Views label (e.g. 18.0K)"
                  defaultValue={v.views}
                  onBlur={(e) => updateField(v.id, 'views', e.target.value)}
                  className="w-40 text-xs border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#9C5A26]"
                />
              </div>

              <button
                onClick={() => removeVideo(v.id)}
                className="shrink-0 self-start p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
