import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'default' | 'warning' | 'danger';
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            tone === 'danger' ? 'bg-red-100 text-red-600' : tone === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-[#9C5A26]/10 text-[#9C5A26]'
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="font-heading text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}
