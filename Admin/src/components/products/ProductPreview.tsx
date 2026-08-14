'use client';

import Image from 'next/image';
import type { StagedImage } from './StagedImageUploader';
import type { DescriptionBlock } from '@/types/api.types';

interface PreviewData {
  name: string;
  category: string;
  basePrice: number;
  purpose: string[];
  description: DescriptionBlock[];
  socialProofText?: string | null;
  benefits: Array<{ title: string; description: string }>;
  howToWear: string[];
  careInstructions?: string | null;
  images: StagedImage[];
}

export function ProductPreview({ data }: { data: PreviewData }) {
  const image = data.images[0]?.full ?? null;

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-6 max-w-2xl">
      <h2 className="font-heading font-bold text-sm text-slate-900 mb-4">Storefront Preview</h2>

      <div className="grid grid-cols-2 gap-6">
        <div className="aspect-square bg-[#F6E4C2] border border-[#2B1B0C]/20 rounded-xl relative overflow-hidden">
          {image ? (
            <Image src={image} alt={data.name || 'Product'} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#8A7A63] text-[10px] font-bold uppercase tracking-widest">
              No Image
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#9C5A26]">{data.category || 'Category'}</span>
          <h3 className="font-heading text-lg font-black text-[#2B1B0C]">{data.name || 'Product Name'}</h3>

          {data.purpose.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.purpose.map((p) => (
                <span key={p} className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 border border-[#2B1B0C]/15 text-[#6B5539] rounded-full">
                  {p}
                </span>
              ))}
            </div>
          )}

          <p className="font-heading text-lg font-bold text-[#2B1B0C]">₹{data.basePrice || 0}</p>

          {data.socialProofText && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#9C5A26]">{data.socialProofText}</p>
          )}

          {data.description.length > 0 && (
            <div className="flex flex-col gap-2">
              {data.description.map((block, i) =>
                block.type === 'text' ? (
                  <p key={i} className="text-xs text-[#6B5539] leading-relaxed">
                    {block.content}
                  </p>
                ) : (
                  // Plain <img> at natural size — `full` is aspect-preserved (uncropped
                  // at upload, unlike `card`'s hard square crop), and a fixed aspect-video
                  // + object-cover box would crop it right back, same bug as the storefront.
                  <div key={i} className="w-full rounded-lg overflow-hidden border border-[#2B1B0C]/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={block.full} alt="" className="w-full h-auto block" />
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {data.benefits.length > 0 && (
        <div className="mt-4">
          <h4 className="font-heading text-sm font-bold text-[#2B1B0C] mb-1">Benefits</h4>
          <ol className="flex flex-col gap-1">
            {data.benefits.map((b, i) => (
              <li key={i} className="text-xs text-[#6B5539] leading-relaxed">
                <span className="font-bold text-[#2B1B0C]">
                  {i + 1}. {b.title}
                </span>{' '}
                — {b.description}
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.howToWear.length > 0 && (
        <div className="mt-4">
          <h4 className="font-heading text-sm font-bold text-[#2B1B0C] mb-1">How to wear?</h4>
          <ol className="flex flex-col gap-1">
            {data.howToWear.map((step, i) => (
              <li key={i} className="text-xs text-[#6B5539] leading-relaxed">
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.careInstructions && (
        <div className="mt-4">
          <h4 className="font-heading text-sm font-bold text-[#2B1B0C] mb-1">Care Instructions</h4>
          <p className="text-xs text-[#6B5539] leading-relaxed">{data.careInstructions}</p>
        </div>
      )}
    </div>
  );
}
