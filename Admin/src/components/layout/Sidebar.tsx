'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, Boxes, ShoppingBag, Gem, Star, Tag, Ticket, Image as ImageIcon, Receipt, Truck, PackageCheck, Rows3, MessageCircle, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/homepage', label: 'Homepage', icon: Rows3 },
  { href: '/banners', label: 'Banners', icon: ImageIcon },
  { href: '/offers', label: 'Offers', icon: Tag },
  { href: '/coupons', label: 'Coupons', icon: Ticket },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/shipping', label: 'Shipping', icon: Truck },
  { href: '/pickup-requests', label: 'Pickup Requests', icon: PackageCheck },
  { href: '/gst-report', label: 'GST Report', icon: Receipt },
  { href: '/reviews', label: 'Reviews', icon: Star },
  { href: '/chat-sessions', label: 'Chat Sessions', icon: MessageCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close } = useSidebar();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Backdrop — mobile/tablet only, shown while the drawer is open. */}
      {isOpen && <div className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden" onClick={close} />}

      <aside
        className={cn(
          'w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col h-screen z-40',
          // Off-canvas drawer on small/medium screens, slides in from the left.
          'fixed top-0 left-0 transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Always visible, static column on large screens.
          'lg:sticky lg:translate-x-0'
        )}
      >
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <Gem className="w-5 h-5 text-[#9C5A26]" />
          <span className="font-heading font-black tracking-tight text-slate-900">Doshhmukti</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-auto lg:inline hidden">Admin</span>
          <button onClick={close} className="lg:hidden ml-auto text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
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
    </>
  );
}
