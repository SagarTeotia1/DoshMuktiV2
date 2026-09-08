'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Truck, AlertTriangle, Receipt } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useGenerateLabel, useBookShipment, useNdrAction, useUpdateEwaybill, useSetRiskFlag } from '@/hooks/use-orders';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { Order } from '@/types/api.types';

const inputClass =
  'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none w-full';

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.body.error : fallback;
}

// Everything here calls Delhivery's live production API — every action has a real,
// physical-world effect (a shipment gets flagged RTO, etc). NDR is gated behind a
// confirm dialog for exactly that reason; label download and saving an e-way bill
// number are low-risk enough not to need one. Pickup is batched, not per-order — see
// the Pickup Requests page.
export function ShippingActions({ order }: { order: Order }) {
  const waybill = order.shipment?.delhiveryWaybill;
  const generateLabel = useGenerateLabel(order.id);
  const bookShipment = useBookShipment(order.id);
  const ndrAction = useNdrAction(order.id);
  const updateEwaybill = useUpdateEwaybill(order.id);
  const setRiskFlag = useSetRiskFlag(order.id);
  const riskFlag = order.shipment?.riskFlag ?? null;

  function handleToggleRiskFlag(flag: 'BAD_ADDRESS' | 'HIGH_RISK') {
    setRiskFlag.mutate(
      { riskFlag: riskFlag === flag ? null : flag },
      {
        onSuccess: () => toast.success(riskFlag === flag ? 'Flag cleared' : 'Shipment flagged'),
        onError: (err) => toast.error(errMsg(err, 'Could not update flag')),
      }
    );
  }

  const [ndrType, setNdrType] = useState<'REATTEMPT' | 'RTO'>('REATTEMPT');
  const [reattemptDate, setReattemptDate] = useState(new Date().toISOString().slice(0, 10));
  const [ndrComment, setNdrComment] = useState('');
  const [confirmNdr, setConfirmNdr] = useState(false);

  const [ewaybillNumber, setEwaybillNumber] = useState(order.shipment?.ewaybillNumber ?? '');

  function handleBookShipment() {
    bookShipment.mutate(undefined, {
      onSuccess: () => toast.success('Shipment booked with Delhivery'),
      onError: (err) => toast.error(errMsg(err, 'Could not book shipment')),
    });
  }

  if (!waybill) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-slate-400">
          No Delhivery waybill yet — the automatic booking on payment either hasn&apos;t run yet or failed.
        </p>
        <button
          onClick={handleBookShipment}
          disabled={bookShipment.isPending}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#9C5A26] hover:bg-[#6B3D19] disabled:opacity-40 transition-colors"
        >
          <Truck className="w-4 h-4" />
          {bookShipment.isPending ? 'Booking...' : 'Book Shipment'}
        </button>
      </div>
    );
  }

  function handleGenerateLabel() {
    generateLabel.mutate(undefined, {
      onSuccess: (data) => window.open(data.pdfUrl, '_blank'),
      onError: (err) => toast.error(errMsg(err, 'Could not fetch label')),
    });
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

      {order.shipment?.pickupRequestId && (
        <p className="text-xs text-slate-500">
          In a pickup batch — see the <a href="/pickup-requests" className="underline">Pickup Requests</a> page.
        </p>
      )}

      <div className="border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> Risk Flag
        </p>
        {riskFlag && (
          <span
            className={`inline-block mb-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              riskFlag === 'BAD_ADDRESS' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {riskFlag === 'BAD_ADDRESS' ? 'Bad Address' : 'High Risk'}
          </span>
        )}
        {order.shipment?.riskReason && <p className="text-xs text-slate-400 mb-2">{order.shipment.riskReason}</p>}
        <p className="text-xs text-slate-400 mb-2">Flagged shipments are excluded from pickup batches until cleared.</p>
        <div className="flex gap-2">
          <button
            onClick={() => handleToggleRiskFlag('BAD_ADDRESS')}
            disabled={setRiskFlag.isPending}
            className={cn(
              'flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40',
              riskFlag === 'BAD_ADDRESS' ? 'bg-amber-600 text-white border-amber-600' : 'text-slate-700 border-slate-300 hover:border-slate-400'
            )}
          >
            {riskFlag === 'BAD_ADDRESS' ? 'Clear Bad Address' : 'Mark Bad Address'}
          </button>
          <button
            onClick={() => handleToggleRiskFlag('HIGH_RISK')}
            disabled={setRiskFlag.isPending}
            className={cn(
              'flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40',
              riskFlag === 'HIGH_RISK' ? 'bg-red-600 text-white border-red-600' : 'text-slate-700 border-slate-300 hover:border-slate-400'
            )}
          >
            {riskFlag === 'HIGH_RISK' ? 'Clear High Risk' : 'Mark High Risk'}
          </button>
        </div>
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
