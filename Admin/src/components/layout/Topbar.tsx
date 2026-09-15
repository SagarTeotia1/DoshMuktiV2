'use client';

import { useRouter } from 'next/navigation';
import { LogOut, Menu } from 'lucide-react';
import { clearToken } from '@/lib/auth';
import { useSidebar } from './SidebarContext';

export function Topbar({ title }: { title: string }) {
  const router = useRouter();
  const { toggle } = useSidebar();

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={toggle} className="lg:hidden text-slate-500 hover:text-slate-900 shrink-0" aria-label="Toggle menu">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-heading font-bold text-base sm:text-lg text-slate-900 truncate">{title}</h1>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors shrink-0"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Log out</span>
      </button>
    </header>
  );
}
