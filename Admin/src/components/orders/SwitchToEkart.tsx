'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Truck } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSwitchToEkart } from '@/hooks/use-orders';
import { ApiError } from '@/lib/api-client';
import type { BulkSwitchResult } from '@/types/api.types';

// Moves every Delhivery booking that has not been picked up yet over to Ekart (prepaid -> Ekart 1 -
// Prepaid, COD -> Ekart 2 - COD). Always previews first; orders Ekart cannot serve stay on Delhivery.
// Each switch cancels the Delhivery waybill and books a new Ekart one, so the old labels stop working.
export function SwitchToEkart() {
  const sw = useSwitchToEkart();
  const [preview, setPreview] = useState<BulkSwitchResult | null>(null);
  const [lastRun, setLastRun] = useState<BulkSwitchResult | null>(null);
  const [confirm, setConfirm] = useState(false);

  function runPreview() {
    setLastRun(null);
    sw.mutate(true, {
      onSuccess: setPreview,
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Could not check orders'),
    });
  }

  function runSwitch() {
    sw.mutate(false, {
      onSuccess: (r) => {
        setLastRun(r);
        setPreview(null);
        if (r.failed.length === 0) toast.success(`Switched ${r.switched} order(s) to Ekart`);
        else toast.error(`${r.switched} switched, ${r.failed.length} failed - see the list`);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.body.error : 'Switch failed'),
      onSettled: () => setConfirm(false),
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-sm text-slate-900 flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#9C5A26]" /> Move Delhivery bookings to Ekart
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Only parcels not yet picked up. Prepaid → Ekart 1 - Prepaid, COD → Ekart 2 - COD. Pincodes Ekart can&apos;t serve stay on Delhivery.
          </p>
        </div>
        <button
          onClick={runPreview}
          disabled={sw.isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 border border-slate-300 hover:border-slate-400 disabled:opacity-40 transition-colors"
        >
          {sw.isPending && !confirm ? 'Checking…' : 'Check orders'}
        </button>
      </div>

      {preview && (
        <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700 flex flex-col gap-2">
          <p>
            <strong>{preview.switched}</strong> order(s) can move to Ekart · <strong>{preview.skipped.length}</strong> will stay on Delhivery ·{' '}
            {preview.eligible} booked on Delhivery and not yet picked up.
          </p>
          {preview.skipped.length > 0 && (
            <ul className="text-xs text-slate-500 list-disc pl-5 max-h-28 overflow-auto">
              {preview.skipped.map((s) => (
                <li key={s.orderNumber}>
                  {s.orderNumber}: {s.reason}
                </li>
              ))}
            </ul>
          )}
          <div>
            <button
              onClick={() => setConfirm(true)}
              disabled={preview.switched === 0 || sw.isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#9C5A26] hover:bg-[#6B3D19] disabled:opacity-40 transition-colors"
            >
              Switch {Math.min(preview.switched, 15)} now
            </button>
            {preview.switched > 15 && <span className="text-xs text-slate-400 ml-2">15 at a time - run again for the rest</span>}
          </div>
        </div>
      )}

      {lastRun && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900 flex flex-col gap-1">
          <p>
            Switched <strong>{lastRun.switched}</strong> · failed <strong>{lastRun.failed.length}</strong> · still to do{' '}
            <strong>{lastRun.remaining}</strong>
            {lastRun.remaining > 0 ? ' - press “Check orders” again.' : '.'}
          </p>
          {lastRun.failed.length > 0 && (
            <ul className="text-xs text-red-700 list-disc pl-5">
              {lastRun.failed.map((f) => (
                <li key={f.orderNumber}>
                  {f.orderNumber}: {f.error}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-emerald-800">Print fresh labels for the switched orders - the old Delhivery labels no longer work.</p>
        </div>
      )}

      <ConfirmDialog
        open={confirm}
        title="Switch to Ekart"
        message="This cancels each order's Delhivery waybill and books a new Ekart waybill. Old labels stop working, so print the new ones afterwards. Continue?"
        onConfirm={runSwitch}
        onCancel={() => setConfirm(false)}
        confirmDisabled={sw.isPending}
      />
    </div>
  );
}
