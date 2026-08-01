'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { clearToken } from '@/lib/auth';

export function Topbar({ title }: { title: string }) {
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <h1 className="font-heading font-bold text-lg text-slate-900">{title}</h1>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        Log out
      </button>
    </header>
  );
}
