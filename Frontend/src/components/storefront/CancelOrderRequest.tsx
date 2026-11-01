'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

// Statuses where nothing has left the warehouse yet — mirrors Backend CANCEL_REQUESTABLE.
const REQUESTABLE = new Set(['PAID', 'PROCESSING', 'PACKED']);

const REASONS = [
  'Ordered by mistake',
  'Found a better price',
  'Want to change item / address',
  'Delivery is taking too long',
  'Other',
];

// Customer asks to cancel; this only notifies the admin team (order stays as-is until they
// review it). Hidden once the order has shipped or is already cancelled.
export function CancelOrderRequest({
  token,
  status,
  alreadyRequested,
}: {
  token: string;
  status: string;
  alreadyRequested: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(alreadyRequested);

  if (!REQUESTABLE.has(status)) return null;

  if (requested) {
    return (
      <p className="mx-auto mb-6 max-w-sm rounded-xl bg-[#9C5A26]/10 px-4 py-3 font-body text-sm font-semibold text-[#2B1B0C]">
        Cancellation requested. Our team will review it and contact you shortly.
      </p>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const text = [reason, note.trim()].filter(Boolean).join(' — ');
    try {
      await api.post(`/api/orders/${token}/cancel-request`, text ? { reason: text.slice(0, 300) } : {});
      setRequested(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.error : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 font-body text-sm font-semibold text-[#B23A2E] underline underline-offset-2 hover:opacity-80"
      >
        Request cancellation
      </button>
    );
  }

  return (
    <div className="mx-auto mb-6 max-w-sm rounded-2xl border border-[#2B1B0C]/15 bg-white p-4 text-left">
      <h2 className="font-body text-sm font-bold text-[#2B1B0C]">Why do you want to cancel?</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`rounded-full border px-3 py-1.5 font-body text-xs font-semibold transition-colors ${
              reason === r ? 'border-[#9C5A26] bg-[#9C5A26] text-white' : 'border-[#2B1B0C]/20 text-[#2B1B0C]'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={150}
        rows={2}
        placeholder="Anything else? (optional)"
        className="mt-3 w-full rounded-xl border border-[#2B1B0C]/20 px-3 py-2 font-body text-base placeholder:text-[#8A7A63] focus:border-[#9C5A26] focus:outline-none focus:ring-2 focus:ring-[#9C5A26] sm:text-sm"
      />
      {error && <p className="mt-2 font-body text-xs font-semibold text-[#B23A2E]">{error}</p>}
      <p className="mt-2 font-body text-[11px] text-[#8A7A63]">
        This sends a request to our team. Your order is cancelled only after they confirm.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="flex-1 rounded-full border border-[#2B1B0C]/30 py-2.5 font-body text-sm font-bold text-[#2B1B0C] disabled:opacity-50"
        >
          Keep order
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex-1 rounded-full bg-[#B23A2E] py-2.5 font-body text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Request cancel'}
        </button>
      </div>
    </div>
  );
}
