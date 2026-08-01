'use client';

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Topbar } from '@/components/layout/Topbar';
import { useInventory, useAdjustStock } from '@/hooks/use-inventory';
import { api, ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

function StockCell({ variantId, quantity }: { variantId: string; quantity: number }) {
  const [value, setValue] = useState(quantity);
  const adjustStock = useAdjustStock();

  function save() {
    if (value === quantity) return;
    adjustStock.mutate(
      { variantId, newQuantity: value, note: 'Admin panel adjustment' },
      { onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Failed to adjust stock') }
    );
  }

  return (
    <input
      type="number"
      value={value}
      onChange={(e) => setValue(Number(e.target.value))}
      onBlur={save}
      className="w-20 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none"
    />
  );
}

export default function InventoryPage() {
  const { data: products, isLoading } = useInventory();
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    try {
      const csv = await api.get<string>('/api/admin/inventory/export');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n').slice(1); // skip header
      const rows = lines.map((line) => {
        const [sku, , , newQuantity] = line.split(',');
        return { sku: sku!.trim(), newQuantity: Number(newQuantity) };
      });
      const result = await api.post<{ results: Array<{ sku: string; ok: boolean; error?: string }> }>('/api/admin/inventory/import', { rows });
      const failed = result.results.filter((r) => !r.ok);
      toast.success(`Imported ${result.results.length - failed.length} rows${failed.length ? `, ${failed.length} failed` : ''}`);
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  }

  return (
    <>
      <Topbar title="Inventory" />
      <div className="p-6 flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 py-8 text-center">Loading...</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">SKU</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Attributes</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Threshold</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase text-slate-500">Stock</th>
                </tr>
              </thead>
              <tbody>
                {products?.flatMap((product) =>
                  product.variants.map((v) => (
                    <tr
                      key={v.id}
                      className={cn(
                        'border-b border-slate-100 last:border-0',
                        v.stockQuantity === 0 ? 'bg-red-50' : v.stockQuantity <= v.lowStockThreshold ? 'bg-amber-50' : ''
                      )}
                    >
                      <td className="px-4 py-2.5 text-slate-700">{product.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{v.sku}</td>
                      <td className="px-4 py-2.5 text-slate-600">{Object.values(v.attributes).join(' / ') || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-600">{v.lowStockThreshold}</td>
                      <td className="px-4 py-2.5">
                        <StockCell variantId={v.id} quantity={v.stockQuantity} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
