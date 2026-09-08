'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { useProducts } from '@/hooks/use-products';

export function ProductPicker({
  excludeIds,
  onPick,
}: {
  excludeIds: string[];
  onPick: (product: { id: string; name: string }) => void;
}) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const { data, isFetching } = useProducts(undefined, 10, 1, debouncedQuery || undefined);

  const excludeSet = new Set(excludeIds);
  const results = (data?.products ?? []).filter((p) => !excludeSet.has(p.id));

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search products to add..."
          className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
        />
      </div>

      {open && debouncedQuery.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isFetching && <div className="px-3 py-2.5 text-sm text-slate-400">Searching...</div>}
          {!isFetching && results.length === 0 && <div className="px-3 py-2.5 text-sm text-slate-400">No matching products</div>}
          {!isFetching &&
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick({ id: p.id, name: p.name });
                  setQuery('');
                  setDebouncedQuery('');
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="truncate">{p.name}</span>
                <Plus className="w-4 h-4 text-[#9C5A26] shrink-0" />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
