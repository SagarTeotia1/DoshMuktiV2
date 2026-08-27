'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Topbar } from '@/components/layout/Topbar';
import { useGstReport } from '@/hooks/use-orders';
import { api } from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function GstReportPage() {
  const [from, setFrom] = useState(firstOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const { data, isLoading } = useGstReport(from, to);

  async function handleExportCsv() {
    try {
      const csv = await api.get<string>(`/api/admin/orders/gst-report?from=${from}&to=${to}&format=csv`);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gst-report-${from}_to_${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }

  return (
    <>
      <Topbar title="GST Report" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg shadow-card p-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
            />
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:border-slate-400 transition-colors ml-auto"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : !data || data.orders.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No GST-rated items found in this date range.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">GST %</th>
                  <th className="px-4 py-3 text-right">Line Total</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">GST Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) =>
                  order.items.map((item, i) => (
                    <tr key={`${order.orderNumber}-${item.sku}-${i}`} className="border-b border-slate-100 last:border-0">
                      {i === 0 && (
                        <>
                          <td className="px-4 py-2.5 font-semibold text-slate-700" rowSpan={order.items.length}>
                            {order.orderNumber}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500" rowSpan={order.items.length}>
                            {formatDate(order.orderDate)}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-2.5">{item.sku}</td>
                      <td className="px-4 py-2.5">{item.productName}</td>
                      <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right">{item.gstRate.toFixed(2)}%</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.lineTotal)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.taxableValue)}</td>
                      <td className="px-4 py-2.5 text-right">{formatCurrency(item.gstAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-bold text-slate-800">
                  <td className="px-4 py-3" colSpan={7}>
                    Grand Total
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(data.totalTaxableValue)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(data.totalGstAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
