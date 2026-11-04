'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, Search, X, Check } from 'lucide-react';
import { DrawerShopBy } from '@/components/layout/DrawerShopBy';

interface CategoryThumb {
  id: string;
  label: string;
  image: string | null;
}

/** "Categories" button + left slide-in drawer: search, photo grid, pick one to filter the shop. */
export function ShopCategoryDrawer({ categories }: { categories: CategoryThumb[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get('category');

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('category', id);
    else params.delete('category');
    params.delete('page');
    router.push(`/shop?${params.toString()}`);
    setOpen(false);
    setQuery('');
  }

  const q = query.trim().toLowerCase();
  const visible = q ? categories.filter((c) => c.label.toLowerCase().includes(q)) : categories;
  const activeLabel = categories.find((c) => c.id === activeCategory)?.label;

  const drawer = (
    <div
      className={`fixed inset-0 z-[60] transition-[visibility] ${open ? '' : 'pointer-events-none invisible delay-300'}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close categories"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-[#2B1B0C]/55 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Categories"
        className={`absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-[#F6E4C2] shadow-[6px_0_24px_rgba(43,27,12,0.3)] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#2B1B0C]/15 px-5 py-3">
          <h2 className="font-heading text-lg font-bold text-[#2B1B0C]">Categories</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close categories"
            className="-mr-2 rounded-full p-2 text-[#2B1B0C] hover:bg-[#EBD6AD]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B5539]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories"
              className="w-full rounded-full border border-[#2B1B0C]/25 bg-[#FFFDF8] py-2.5 pl-9 pr-4 font-body text-sm text-[#2B1B0C] placeholder:text-[#8A7A63] focus:outline-none focus:ring-2 focus:ring-[#9C5A26]"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5">
          {visible.length === 0 ? (
            <p className="py-8 text-center font-body text-sm text-[#6B5539]">No category matches &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-x-3 gap-y-5">
              {visible.map((c) => {
                const active = activeCategory === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => select(active ? null : c.id)}
                      aria-pressed={active}
                      className="group flex w-full flex-col items-center gap-2"
                    >
                      <span
                        className={`relative aspect-square w-full overflow-hidden rounded-lg bg-[#E6D3AE] transition-all ${
                          active ? 'ring-2 ring-[#9C5A26] ring-offset-2 ring-offset-[#F6E4C2]' : 'ring-1 ring-[#2B1B0C]/10'
                        }`}
                      >
                        {c.image ? (
                          <Image
                            src={c.image}
                            alt=""
                            fill
                            sizes="30vw"
                            className="object-cover transition-transform duration-300 group-active:scale-105"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-heading text-2xl font-bold text-[#9C5A26]">
                            {c.label[0]}
                          </span>
                        )}
                        {active && (
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#9C5A26] text-white">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span
                        className={`line-clamp-2 text-center font-body text-xs leading-tight ${
                          active ? 'font-bold text-[#2B1B0C]' : 'font-semibold text-[#2B1B0C]'
                        }`}
                      >
                        {c.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Hidden while searching categories, so results stay the focus. */}
          {!q && <DrawerShopBy onNavigate={() => setOpen(false)} />}
        </div>

        <div className="border-t border-[#2B1B0C]/15 px-5 py-3">
          <button
            type="button"
            onClick={() => select(null)}
            className="w-full rounded-lg bg-[#2B1B0C] py-3 font-body text-sm font-semibold text-[#F6E4C2] active:bg-[#9C5A26]"
          >
            {activeCategory ? 'Clear filter, show all' : 'Show all products'}
          </button>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-full border border-[#2B1B0C] bg-[#2B1B0C] py-1.5 pl-3 pr-3.5 font-body text-xs font-semibold text-[#F6E4C2] transition-colors hover:bg-[#9C5A26]"
      >
        <LayoutGrid className="h-3.5 w-3.5 text-[#E8A850]" strokeWidth={2} />
        <span className="max-w-[9rem] truncate">{activeLabel ?? 'Categories'}</span>
      </button>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
