'use client';

import { useMemo, useState } from 'react';
import { useProducts } from '@/hooks/use-products';

// No status filter here: an offer already linked to a since-archived/draft
// product must keep showing (and stay checked) here, or saving the form
// would silently unlink it — the checked set IS the `productIds` payload on
// submit. Capped at the backend's max page size (100); see use-products.ts.
export function ProductScopePicker({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useProducts(undefined, 100);
  const products = data?.products ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products..."
        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
      />
      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
        {isLoading ? (
          <p className="text-xs text-slate-400 px-3 py-3">Loading products...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-400 px-3 py-3">No products match.</p>
        ) : (
          filtered.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <label
                key={p.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  checked ? 'bg-[#9C5A26]/5' : 'hover:bg-slate-50'
                }`}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="w-4 h-4 accent-[#9C5A26]" />
                <span className="text-sm text-slate-700 flex-1">{p.name}</span>
                {p.status !== 'ACTIVE' && <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{p.status}</span>}
              </label>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-slate-400 mt-1">{selectedIds.length} selected</p>
    </div>
  );
}
