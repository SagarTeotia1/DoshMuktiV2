'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Boxes, ShoppingBag, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
        <Gem className="w-5 h-5 text-[#9C5A26]" />
        <span className="font-heading font-black tracking-tight text-slate-900">Doshhmukti</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-auto">Admin</span>
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-[#9C5A26]/10 text-[#6B3D19]' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
