'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Truck, PackageCheck } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn, formatDate } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import { usePendingPickupCount, usePickupRequests, useCreatePickupRequest } from '@/hooks/use-pickup-requests';

const inputClass =
  'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none w-full';

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.body.error : fallback;
}

function RequestPickupCard() {
  const { data: pending, isLoading } = usePendingPickupCount();
  const createRequest = useCreatePickupRequest();
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().slice(0, 10));
  const [pickupTime, setPickupTime] = useState('14:00');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const count = pending?.count ?? 0;

  function handleCreate() {
    createRequest.mutate(
      { pickupDate, pickupTime },
      {
        onSuccess: (data) => toast.success(`Pickup requested for ${data.expectedPackageCount} package${data.expectedPackageCount === 1 ? '' : 's'}`),
        onError: (err) => toast.error(errMsg(err, 'Pickup request failed')),
        onSettled: () => setConfirmOpen(false),
      }
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
      <h2 className="font-heading font-bold text-sm text-slate-900 mb-1">Request Pickup</h2>
      <p className="text-xs text-slate-400 mb-4">
        Books one Delhivery pickup slot covering every booked shipment waiting right now — never one call per order.
      </p>

      <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg bg-[#9C5A26]/5 border border-[#9C5A26]/20">
        <PackageCheck className="w-4 h-4 text-[#9C5A26] shrink-0" />
        <p className="text-sm text-slate-700">
          {isLoading ? 'Loading...' : (
            <>
              <span className="font-bold text-slate-900">{count}</span> shipment{count === 1 ? '' : 's'} waiting for pickup
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputClass} />
        <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className={inputClass} />
      </div>

      <button
        onClick={() => setConfirmOpen(true)}
        disabled={createRequest.isPending || count === 0}
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#9C5A26] hover:bg-[#6B3D19] disabled:opacity-40 transition-colors"
      >
        <Truck className="w-4 h-4" />
        {createRequest.isPending ? 'Requesting...' : 'Request Pickup'}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Request Pickup"
        message={`Request a Delhivery pickup for ${pickupDate} at ${pickupTime} covering ${count} shipment${count === 1 ? '' : 's'}? This books a real courier slot.`}
        onConfirm={handleCreate}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function statusClass(status: string) {
  return status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700';
}

function HistoryCard() {
  const { data, isLoading } = usePickupRequests();

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
      <h2 className="font-heading font-bold text-sm text-slate-900 mb-4">Pickup History</h2>
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : !data?.requests.length ? (
        <p className="text-sm text-slate-400">No pickups requested yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                <th className="pb-2 font-semibold">Date / Time</th>
                <th className="pb-2 font-semibold">Packages</th>
                <th className="pb-2 font-semibold">Delhivery ID</th>
                <th className="pb-2 font-semibold">Status</th>
                <th className="pb-2 font-semibold">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.requests.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 text-slate-700">{r.pickupDate} {r.pickupTime}</td>
                  <td className="py-2.5 text-slate-700">{r.expectedPackageCount}</td>
                  <td className="py-2.5 text-slate-500">{r.delhiveryPickupId ?? '—'}</td>
                  <td className="py-2.5">
                    <span className={cn('inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider', statusClass(r.status))}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-500">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PickupRequestsPage() {
  return (
    <>
      <Topbar title="Pickup Requests" />
      <div className="p-6 grid md:grid-cols-2 gap-6 items-start">
        <RequestPickupCard />
        <HistoryCard />
      </div>
    </>
  );
}
