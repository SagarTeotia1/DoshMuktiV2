'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAddVariant, useUpdateVariant } from '@/hooks/use-products';
import { ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import type { Product, ProductVariant } from '@/types/api.types';

function VariantRow({ variant, productId }: { variant: ProductVariant; productId: string }) {
  const updateVariant = useUpdateVariant(productId);
  const [stock, setStock] = useState(variant.stockQuantity);

  function saveStock() {
    if (stock === variant.stockQuantity) return;
    updateVariant.mutate(
      { variantId: variant.id, input: { stockQuantity: stock } },
      { onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to update stock') }
    );
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2.5 text-slate-700">{variant.sku}</td>
      <td className="px-4 py-2.5 text-slate-600">{Object.values(variant.attributes).join(' / ') || '—'}</td>
      <td className="px-4 py-2.5 text-slate-700">{variant.priceOverride ? formatCurrency(variant.priceOverride) : '—'}</td>
      <td className="px-4 py-2.5">
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(Number(e.target.value))}
          onBlur={saveStock}
          className="w-20 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
        />
      </td>
      <td className="px-4 py-2.5">
        <button
          onClick={() => updateVariant.mutate({ variantId: variant.id, input: { isActive: !variant.isActive } })}
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
            variant.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {variant.isActive ? 'Active' : 'Inactive'}
        </button>
      </td>
    </tr>
  );
}

export function VariantsPanel({ product }: { product: Product }) {
  const addVariant = useAddVariant(product.id);
  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState('');
  const [attrs, setAttrs] = useState('');
  const [stock, setStock] = useState(0);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    let attributes: Record<string, string> = {};
    try {
      attributes = attrs.trim() ? JSON.parse(attrs) : {};
    } catch {
      toast.error('Attributes must be valid JSON, e.g. {"size":"M"}');
      return;
    }

    addVariant.mutate(
      { sku, attributes, stockQuantity: stock },
      {
        onSuccess: () => {
          toast.success('Variant added');
          setShowForm(false);
          setSku('');
          setAttrs('');
          setStock(0);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to add variant'),
      }
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="font-heading font-bold text-sm text-slate-900">Variants</h2>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-[#9C5A26] hover:text-[#6B3D19]">
          <Plus className="w-3.5 h-3.5" />
          Add Variant
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">SKU</label>
            <input required value={sku} onChange={(e) => setSku(e.target.value)} className="border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Attributes (JSON)</label>
            <input
              value={attrs}
              onChange={(e) => setAttrs(e.target.value)}
              placeholder='{"size":"M","color":"Red"}'
              className="border border-slate-300 rounded px-2 py-1.5 text-sm w-56"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Stock</label>
            <input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} className="border border-slate-300 rounded px-2 py-1.5 text-sm w-24" />
          </div>
          <button type="submit" disabled={addVariant.isPending} className="bg-[#9C5A26] text-white text-xs font-semibold px-4 py-2 rounded hover:bg-[#6B3D19] disabled:opacity-50">
            Add
          </button>
        </form>
      )}

      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-slate-500">SKU</th>
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-slate-500">Attributes</th>
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-slate-500">Price Override</th>
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-slate-500">Stock</th>
            <th className="text-left px-4 py-2 text-xs font-semibold uppercase text-slate-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {product.variants.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-sm">
                No variants yet
              </td>
            </tr>
          ) : (
            product.variants.map((v) => <VariantRow key={v.id} variant={v} productId={product.id} />)
          )}
        </tbody>
      </table>
    </div>
  );
}
