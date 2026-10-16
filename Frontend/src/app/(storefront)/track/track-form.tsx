'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';

const inputClass =
  'flex-1 rounded-full border border-[#2B1B0C]/20 bg-white px-5 py-3.5 font-body text-sm text-[#2B1B0C] placeholder:text-[#8A7A63] focus:outline-none focus:ring-2 focus:ring-[#9C5A26]';

// The order number alone is sequential (…0020 → …0021), so it can't open an order by itself — the
// backend only hands back the private link when it's paired with the phone number on the order.
export function TrackForm() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await api.post<{ token: string }>('/api/orders/lookup', {
        orderNumber: orderNumber.trim().toUpperCase(),
        phone: phone.replace(/\D/g, '').slice(-10),
      });
      router.push(`/track/${token}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.error : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          required
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order number (e.g. DOSH-20261002-0001)"
          autoCapitalize="characters"
          autoComplete="off"
          className={inputClass}
        />
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number used on the order"
          inputMode="tel"
          autoComplete="tel"
          className={inputClass}
        />
      </div>
      {error && <p className="font-body text-sm text-brand-alert">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-3.5 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200 disabled:opacity-60"
      >
        {loading ? 'Finding…' : 'Track Order'}
      </button>
    </form>
  );
}
