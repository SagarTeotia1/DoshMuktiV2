'use client';

import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Eye, EyeOff } from 'lucide-react';
import { PURPOSE_IDS, PRODUCT_STATUSES } from '@/lib/constants';
import type { Product } from '@/types/api.types';
import { StagedImageUploader } from './StagedImageUploader';
import { ProductPreview } from './ProductPreview';

const imageSchema = z.object({ thumb: z.string(), card: z.string(), full: z.string() });

const productFormSchema = z.object({
  name: z.string().min(1, 'Required'),
  slug: z.string().min(2, 'Required').regex(/^[a-z0-9-]+$/, 'Lowercase, numbers, hyphens only'),
  description: z.string().min(1, 'Required'),
  category: z.string().min(1, 'Required'),
  basePrice: z.coerce.number().positive('Must be positive'),
  purpose: z.array(z.enum(PURPOSE_IDS)).default([]),
  badge: z.string().optional(),
  featured: z.boolean().default(false),
  status: z.enum(PRODUCT_STATUSES).optional(),
  images: z.array(imageSchema).default([]),
  benefits: z.array(z.object({ title: z.string().min(1, 'Required'), description: z.string().min(1, 'Required') })).default([]),
  howToWear: z.array(z.object({ text: z.string().min(1, 'Required') })).default([]),
  careInstructions: z.string().optional(),
  socialProofText: z.string().optional(),
});

type FormShape = z.infer<typeof productFormSchema>;

// howToWear is stored internally as {text}[] because react-hook-form's
// useFieldArray requires array items to be objects — flattened to string[]
// at the submit boundary so consumers/Backend only ever see string[].
export type ProductFormValues = Omit<FormShape, 'howToWear'> & { howToWear: string[] };

const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

export function ProductForm({
  defaultValues,
  onSubmit,
  submitLabel,
  submitting,
}: {
  defaultValues?: Partial<Product>;
  onSubmit: (values: ProductFormValues) => void;
  submitLabel: string;
  submitting: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormShape>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      slug: defaultValues?.slug ?? '',
      description: defaultValues?.description ?? '',
      category: defaultValues?.category ?? '',
      basePrice: defaultValues?.basePrice ?? 0,
      purpose: (defaultValues?.purpose as (typeof PURPOSE_IDS)[number][]) ?? [],
      badge: defaultValues?.badge ?? '',
      featured: defaultValues?.featured ?? false,
      status: defaultValues?.status,
      images: defaultValues?.images ?? [],
      benefits: defaultValues?.benefits ?? [],
      howToWear: defaultValues?.howToWear?.map((text) => ({ text })) ?? [],
      careInstructions: defaultValues?.careInstructions ?? '',
      socialProofText: defaultValues?.socialProofText ?? '',
    },
  });

  const selectedPurposes = watch('purpose');
  const previewValues = watch();

  function togglePurpose(id: (typeof PURPOSE_IDS)[number]) {
    const current = selectedPurposes ?? [];
    setValue('purpose', current.includes(id) ? current.filter((p) => p !== id) : [...current, id]);
  }

  const benefitsArray = useFieldArray({ control, name: 'benefits' });
  const howToWearArray = useFieldArray({ control, name: 'howToWear' });

  function submit(values: FormShape) {
    onSubmit({ ...values, howToWear: values.howToWear.map((s) => s.text) });
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <button
        type="button"
        onClick={() => setShowPreview((v) => !v)}
        className="self-start flex items-center gap-1.5 text-xs font-semibold text-[#9C5A26] hover:text-[#6B3D19] transition-colors"
      >
        {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        {showPreview ? 'Hide Preview' : 'Preview'}
      </button>

      {showPreview && (
        <ProductPreview
          data={{
            name: previewValues.name,
            category: previewValues.category,
            basePrice: previewValues.basePrice,
            purpose: previewValues.purpose ?? [],
            description: previewValues.description,
            socialProofText: previewValues.socialProofText,
            benefits: previewValues.benefits ?? [],
            howToWear: (previewValues.howToWear ?? []).map((s) => s.text),
            careInstructions: previewValues.careInstructions,
            images: previewValues.images ?? [],
          }}
        />
      )}

      <form onSubmit={handleSubmit(submit)} className="bg-white border border-slate-200 rounded-lg shadow-card p-6 flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Name</label>
          <input {...register('name')} className={inputClass} />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Slug</label>
          <input {...register('slug')} className={inputClass} />
          {errors.slug && <p className="text-xs text-red-600 mt-1">{errors.slug.message}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
          <textarea {...register('description')} rows={4} className={inputClass} />
          {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Category</label>
            <input {...register('category')} className={inputClass} />
            {errors.category && <p className="text-xs text-red-600 mt-1">{errors.category.message}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Base Price (₹)</label>
            <input type="number" step="0.01" {...register('basePrice')} className={inputClass} />
            {errors.basePrice && <p className="text-xs text-red-600 mt-1">{errors.basePrice.message}</p>}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-2 block">Purpose Tags</label>
          <div className="flex flex-wrap gap-2">
            {PURPOSE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => togglePurpose(id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedPurposes?.includes(id) ? 'bg-[#9C5A26] text-white border-[#9C5A26]' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Badge (optional)</label>
            <input {...register('badge')} placeholder="Bestseller, New, Limited Edition" className={inputClass} />
          </div>
          <label className="flex items-center gap-2 pb-2.5">
            <input type="checkbox" {...register('featured')} className="w-4 h-4 accent-[#9C5A26]" />
            <span className="text-sm text-slate-700">Featured on homepage</span>
          </label>
        </div>

        {defaultValues && (
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Status</label>
            <select {...register('status')} className={inputClass}>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Social Proof Text (optional)</label>
          <input {...register('socialProofText')} placeholder="Loved by 15 lakh+ customers" className={inputClass} />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-2 block">Benefits</label>
          <div className="flex flex-col gap-2">
            {benefitsArray.fields.map((field, i) => (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1 flex flex-col gap-1.5">
                  <input {...register(`benefits.${i}.title`)} placeholder="Title" className={inputClass} />
                  <input {...register(`benefits.${i}.description`)} placeholder="Description" className={inputClass} />
                </div>
                <button type="button" onClick={() => benefitsArray.remove(i)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => benefitsArray.append({ title: '', description: '' })}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#9C5A26] hover:text-[#6B3D19] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Benefit
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-2 block">How to Wear</label>
          <div className="flex flex-col gap-2">
            {howToWearArray.fields.map((field, i) => (
              <div key={field.id} className="flex gap-2 items-center">
                <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
                <input {...register(`howToWear.${i}.text`)} placeholder={`Step ${i + 1}`} className={inputClass} />
                <button type="button" onClick={() => howToWearArray.remove(i)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => howToWearArray.append({ text: '' })}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#9C5A26] hover:text-[#6B3D19] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Step
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Care Instructions (optional)</label>
          <textarea {...register('careInstructions')} rows={3} className={inputClass} />
        </div>

        {!defaultValues && (
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Images</label>
            <Controller
              control={control}
              name="images"
              render={({ field }) => <StagedImageUploader images={field.value ?? []} onChange={field.onChange} />}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 bg-[#9C5A26] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#6B3D19] transition-colors disabled:opacity-50 w-fit px-6"
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </form>
    </div>
  );
}
