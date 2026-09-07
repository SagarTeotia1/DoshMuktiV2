'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Truck, AlertTriangle, Receipt } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useGenerateLabel, useRaisePickup, useNdrAction, useUpdateEwaybill } from '@/hooks/use-orders';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/utils';
import type { Order } from '@/types/api.types';

const inputClass =
  'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none w-full';

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.body.error : fallback;
}

// Everything here calls Delhivery's live production API — every action has a real,
// physical-world effect (a courier gets a pickup slot booked, a shipment gets flagged
// RTO, etc). Pickup + NDR are gated behind a confirm dialog for exactly that reason;
// label download and saving an e-way bill number are low-risk enough not to need one.
export function ShippingActions({ order }: { order: Order }) {
  const waybill = order.shipment?.delhiveryWaybill;
  const generateLabel = useGenerateLabel(order.id);
  const raisePickup = useRaisePickup(order.id);
  const ndrAction = useNdrAction(order.id);
  const updateEwaybill = useUpdateEwaybill(order.id);

  const [pickupDate, setPickupDate] = useState(new Date().toISOString().slice(0, 10));
  const [pickupTime, setPickupTime] = useState('14:00');
  const [packageCount, setPackageCount] = useState(1);
  const [confirmPickup, setConfirmPickup] = useState(false);

  const [ndrType, setNdrType] = useState<'REATTEMPT' | 'RTO'>('REATTEMPT');
  const [reattemptDate, setReattemptDate] = useState(new Date().toISOString().slice(0, 10));
  const [ndrComment, setNdrComment] = useState('');
  const [confirmNdr, setConfirmNdr] = useState(false);

  const [ewaybillNumber, setEwaybillNumber] = useState(order.shipment?.ewaybillNumber ?? '');

  if (!waybill) {
    return <p className="text-xs text-slate-400">No Delhivery waybill yet — actions unlock once the shipment is booked.</p>;
  }

  function handleGenerateLabel() {
    generateLabel.mutate(undefined, {
      onSuccess: (data) => window.open(data.pdfUrl, '_blank'),
      onError: (err) => toast.error(errMsg(err, 'Could not fetch label')),
    });
  }

  function handleRaisePickup() {
    raisePickup.mutate(
      { pickupDate, pickupTime, expectedPackageCount: packageCount },
      {
        onSuccess: () => toast.success('Pickup requested'),
        onError: (err) => toast.error(errMsg(err, 'Pickup request failed')),
        onSettled: () => setConfirmPickup(false),
      }
    );
  }

  function handleNdrAction() {
    ndrAction.mutate(
      {
        action: ndrType,
        ...(ndrType === 'REATTEMPT' ? { reattemptDate } : {}),
        ...(ndrComment ? { comment: ndrComment } : {}),
      },
      {
        onSuccess: () => toast.success(`NDR action (${ndrType}) submitted`),
        onError: (err) => toast.error(errMsg(err, 'NDR action failed')),
        onSettled: () => setConfirmNdr(false),
      }
    );
  }

  function handleEwaybillSave() {
    if (!ewaybillNumber.trim()) return;
    updateEwaybill.mutate(
      { ewaybillNumber: ewaybillNumber.trim() },
      {
        onSuccess: () => toast.success('E-way bill saved'),
        onError: (err) => toast.error(errMsg(err, 'Could not save e-way bill')),
      }
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <button
        onClick={handleGenerateLabel}
        disabled={generateLabel.isPending}
        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 border border-slate-300 hover:border-slate-400 disabled:opacity-40 transition-colors"
      >
        <FileText className="w-4 h-4" />
        {generateLabel.isPending ? 'Fetching...' : 'Generate Shipping Label'}
      </button>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" /> Pickup
        </p>
        {order.shipment?.pickupRequestedAt ? (
          <p className="text-xs text-slate-500">Requested on {formatDate(order.shipment.pickupRequestedAt)}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className={inputClass} />
              <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className={inputClass} />
            </div>
            <input
              type="number"
              min={1}
              value={packageCount}
              onChange={(e) => setPackageCount(Number(e.target.value))}
              placeholder="Expected package count"
              className={inputClass}
            />
            <button
              onClick={() => setConfirmPickup(true)}
              disabled={raisePickup.isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#9C5A26] hover:bg-[#6B3D19] disabled:opacity-40 transition-colors"
            >
              Raise Pickup Request
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> NDR Action
        </p>
        <div className="flex flex-col gap-2">
          <select value={ndrType} onChange={(e) => setNdrType(e.target.value as 'REATTEMPT' | 'RTO')} className={inputClass}>
            <option value="REATTEMPT">Reattempt Delivery</option>
            <option value="RTO">Return to Origin (RTO)</option>
          </select>
          {ndrType === 'REATTEMPT' && (
            <input type="date" value={reattemptDate} onChange={(e) => setReattemptDate(e.target.value)} className={inputClass} />
          )}
          <textarea
            value={ndrComment}
            onChange={(e) => setNdrComment(e.target.value)}
            placeholder="Comment (optional)"
            rows={2}
            className={inputClass}
          />
          <button
            onClick={() => setConfirmNdr(true)}
            disabled={ndrAction.isPending}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40 transition-colors"
          >
            Submit NDR Action
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> E-way Bill
        </p>
        <div className="flex gap-2">
          <input
            value={ewaybillNumber}
            onChange={(e) => setEwaybillNumber(e.target.value)}
            placeholder="E-way bill number"
            className={inputClass}
          />
          <button
            onClick={handleEwaybillSave}
            disabled={updateEwaybill.isPending || !ewaybillNumber.trim()}
            className="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 border border-slate-300 hover:border-slate-400 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmPickup}
        title="Raise Pickup Request"
        message={`Request a Delhivery pickup for ${pickupDate} at ${pickupTime} (${packageCount} package${packageCount === 1 ? '' : 's'})? This books a real courier slot.`}
        onConfirm={handleRaisePickup}
        onCancel={() => setConfirmPickup(false)}
      />
      <ConfirmDialog
        open={confirmNdr}
        title="Submit NDR Action"
        message={
          ndrType === 'RTO'
            ? 'Mark this shipment for Return to Origin? This is sent to Delhivery immediately.'
            : `Reattempt delivery on ${reattemptDate}? This is sent to Delhivery immediately.`
        }
        onConfirm={handleNdrAction}
        onCancel={() => setConfirmNdr(false)}
      />
    </div>
  );
}
