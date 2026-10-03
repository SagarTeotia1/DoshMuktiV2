'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TrackForm() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = orderNumber.trim().toUpperCase();
    if (value) router.push(`/track/${encodeURIComponent(value)}`);
  };

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3">
      <input
        required
        value={orderNumber}
        onChange={(e) => setOrderNumber(e.target.value)}
        placeholder="Order number (e.g. DOSH-20261002-0001)"
        autoCapitalize="characters"
        autoComplete="off"
        className="flex-1 rounded-full border border-[#2B1B0C]/20 bg-white px-5 py-3.5 font-body text-sm text-[#2B1B0C] placeholder:text-[#8A7A63] focus:outline-none focus:ring-2 focus:ring-[#9C5A26]"
      />
      <button
        type="submit"
        className="bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-8 py-3.5 font-body font-bold uppercase tracking-widest text-sm hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200"
      >
        Track Order
      </button>
    </form>
  );
}
