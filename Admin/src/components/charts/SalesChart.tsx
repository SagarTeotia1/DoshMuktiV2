'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { SalesTrendPoint } from '@/types/api.types';

export function SalesChart({ data }: { data: SalesTrendPoint[] }) {
  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-sm text-slate-400">No sales data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={(v: string) => v.slice(5)}
          axisLine={{ stroke: '#e2e8f0' }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `₹${v / 1000}k`} />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
        />
        <Line type="monotone" dataKey="revenue" stroke="#9C5A26" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
