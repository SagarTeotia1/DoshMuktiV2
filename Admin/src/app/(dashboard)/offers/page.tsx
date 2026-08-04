'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { useOffers, useCreateOffer, useUpdateOffer, type CreateOfferInput } from '@/hooks/use-offers';
import { useProducts } from '@/hooks/use-products';
import { formatDate } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import type { Offer } from '@/types/api.types';

const TYPES: Array<{ value: Offer['type']; label: string }> = [
  { value: 'DISPLAY', label: 'Display only (tag)' },
  { value: 'FREE_ITEM', label: 'Free item' },
  { value: 'CASHBACK', label: 'Cashback' },
  { value: 'DISCOUNT', label: 'Discount' },
];

const inputClass = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none';

const TYPE_BADGE: Record<Offer['type'], string> = {
  DISPLAY: 'bg-slate-100 text-slate-600',
  FREE_ITEM: 'bg-emerald-50 text-emerald-700',
  CASHBACK: 'bg-[#9C5A26]/10 text-[#6B3D19]',
  DISCOUNT: 'bg-blue-50 text-blue-700',
};

export default function OffersPage() {
  const { data: offers, isLoading } = useOffers();
  const { data: products } = useProducts('ACTIVE');
  const createOffer = useCreateOffer();
  const updateOffer = useUpdateOffer();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<Offer['type']>('DISPLAY');
  const [cashbackPercent, setCashbackPercent] = useState(0);
  const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState(0);
  const [maxDiscount, setMaxDiscount] = useState(0);
  const [freeProductId, setFreeProductId] = useState('');

  function resetForm() {
    setTitle('');
    setType('DISPLAY');
    setCashbackPercent(0);
    setDiscountType('PERCENT');
    setDiscountValue(0);
    setMaxDiscount(0);
    setFreeProductId('');
  }

  function handleCreate() {
    const value = title.trim();
    if (!value) return;

    const input: CreateOfferInput = { title: value, type };
    if (type === 'CASHBACK') input.cashbackPercent = cashbackPercent;
    if (type === 'DISCOUNT') {
      input.discountType = discountType;
      input.discountValue = discountValue;
      if (maxDiscount > 0) input.maxDiscount = maxDiscount;
    }
    if (type === 'FREE_ITEM') input.freeProductId = freeProductId || null;

    createOffer.mutate(input, {
      onSuccess: () => {
        toast.success('Offer created');
        resetForm();
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to create offer'),
    });
  }

  function toggleActive(id: string, isActive: boolean) {
    updateOffer.mutate(
      { id, input: { isActive: !isActive } },
      { onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update offer') }
    );
  }

  return (
    <>
      <Topbar title="Offers" />
      <div className="p-6 flex flex-col gap-4 max-w-2xl">
        <p className="text-sm text-slate-500">
          Create offers here, then enable the ones that apply on each product's edit page. Free item / Cashback / Discount
          apply automatically at checkout — no coupon code needed.
        </p>

        <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4 flex flex-col gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 100% Cashback on First Order"
            className={inputClass}
          />

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as Offer['type'])} className={inputClass}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {type === 'CASHBACK' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Cashback %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={cashbackPercent}
                onChange={(e) => setCashbackPercent(Number(e.target.value))}
                className={`${inputClass} max-w-[140px]`}
              />
            </div>
          )}

          {type === 'DISCOUNT' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Discount Type</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'FLAT' | 'PERCENT')} className={inputClass}>
                  <option value="PERCENT">Percent</option>
                  <option value="FLAT">Flat (₹)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Value</label>
                <input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} className={inputClass} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Max Discount (₹) <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input type="number" min={0} value={maxDiscount} onChange={(e) => setMaxDiscount(Number(e.target.value))} className={inputClass} />
              </div>
            </div>
          )}

          {type === 'FREE_ITEM' && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Free Product</label>
              <select value={freeProductId} onChange={(e) => setFreeProductId(e.target.value)} className={inputClass}>
                <option value="">Select product...</option>
                {products?.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={createOffer.isPending || !title.trim()}
            className="self-start flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#9C5A26] text-white text-sm font-semibold hover:bg-[#6B3D19] disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Offer
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : !offers || offers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg shadow-card p-10 text-center text-sm text-slate-400">
            No offers yet — add one above.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-card divide-y divide-slate-100">
            {offers.map((offer) => (
              <div key={offer.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${offer.isActive ? 'text-slate-900' : 'text-slate-400 line-through'}`}>{offer.title}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${TYPE_BADGE[offer.type]}`}>
                      {offer.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Created {formatDate(offer.createdAt)}</p>
                </div>
                <label className="flex items-center gap-2 flex-shrink-0 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-500">{offer.isActive ? 'Active' : 'Inactive'}</span>
                  <input
                    type="checkbox"
                    checked={offer.isActive}
                    onChange={() => toggleActive(offer.id, offer.isActive)}
                    className="w-4 h-4 accent-[#9C5A26]"
                  />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
