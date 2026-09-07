'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Topbar } from '@/components/layout/Topbar';
import { useWarehouseInfo, useCalculateRate } from '@/hooks/use-shipping';
import { ApiError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';

const inputClass =
  'bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:outline-none w-full';

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.body.error : fallback;
}

function WarehouseCard() {
  const { data, isLoading } = useWarehouseInfo();

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
      <h2 className="font-heading font-bold text-sm text-slate-900 mb-1">Pickup Warehouse</h2>
      <p className="text-xs text-slate-400 mb-4">
        Set up directly on Delhivery&apos;s own dashboard, not here — every shipment is booked against this pickup location by name.
      </p>
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Name</dt>
            <dd className="font-semibold text-slate-900">{data?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">City / State</dt>
            <dd className="text-slate-700">{data?.city}, {data?.state}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Pincode</dt>
            <dd className="text-slate-700">{data?.pincode}</dd>
          </div>
          {data?.phone && (
            <div className="flex justify-between">
              <dt className="text-slate-500">Phone</dt>
              <dd className="text-slate-700">{data.phone}</dd>
            </div>
          )}
          {data?.address && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500 flex-shrink-0">Address</dt>
              <dd className="text-slate-700 text-right">{data.address}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function RateCalculatorCard() {
  const calculateRate = useCalculateRate();
  const [destPincode, setDestPincode] = useState('');
  const [weightGrams, setWeightGrams] = useState(500);
  const [paymentMode, setPaymentMode] = useState<'Pre-paid' | 'COD'>('Pre-paid');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    calculateRate.mutate(
      { destPincode, weightGrams, paymentMode },
      { onError: (err) => toast.error(errMsg(err, 'Could not calculate rate')) }
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-card p-5">
      <h2 className="font-heading font-bold text-sm text-slate-900 mb-4">Shipping Rate Calculator</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          required
          placeholder="Destination pincode"
          value={destPincode}
          onChange={(e) => setDestPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className={inputClass}
        />
        <input
          required
          type="number"
          min={1}
          placeholder="Weight (grams)"
          value={weightGrams}
          onChange={(e) => setWeightGrams(Number(e.target.value))}
          className={inputClass}
        />
        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as 'Pre-paid' | 'COD')} className={inputClass}>
          <option value="Pre-paid">Pre-paid</option>
          <option value="COD">COD</option>
        </select>
        <button
          type="submit"
          disabled={calculateRate.isPending}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:opacity-40 transition-colors"
        >
          {calculateRate.isPending ? 'Calculating...' : 'Calculate'}
        </button>
      </form>
      {calculateRate.data && (
        <p className="mt-4 text-sm text-slate-700">
          Estimated cost: <span className="font-heading font-bold text-slate-900">{formatCurrency(calculateRate.data.amount)}</span>
        </p>
      )}
    </div>
  );
}

export default function ShippingPage() {
  return (
    <>
      <Topbar title="Shipping" />
      <div className="p-6 grid md:grid-cols-2 gap-6 items-start">
        <WarehouseCard />
        <RateCalculatorCard />
      </div>
    </>
  );
}
