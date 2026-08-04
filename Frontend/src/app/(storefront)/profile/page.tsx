'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Phone, Cake, MapPin, LogOut, PackageSearch } from 'lucide-react';
import { api } from '@/lib/api-client';
import { getToken } from '@/lib/auth';
import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/formatters';
import type { OrderTrackingResponse } from '@/types/api.types';

function Row({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#2B1B0C]/8 last:border-b-0">
      <div className="w-8 h-8 rounded-full bg-[#F6E4C2] flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-[#9C5A26]" />
      </div>
      <div>
        <p className="font-body text-[10px] font-bold uppercase tracking-wider text-[#8A7A63]">{label}</p>
        <p className="font-body text-sm text-[#2B1B0C] font-semibold">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [latestOrder, setLatestOrder] = useState<OrderTrackingResponse | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login?redirect=/profile');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    api
      .get<OrderTrackingResponse[]>('/api/orders/mine', { Authorization: `Bearer ${getToken()}` }, 0)
      .then((orders) => setLatestOrder(orders[0] ?? null))
      .catch(() => {});
  }, [isAuthenticated]);

  if (authLoading || !isAuthenticated || !user) {
    return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24 text-center font-body text-sm text-[#8A7A63]">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-heading font-black tracking-tight leading-tight text-2xl sm:text-3xl text-[#2B1B0C] mb-1.5">
        Your Profile
      </h1>
      <p className="font-body text-sm text-[#8A7A63] mb-8">Signed in with OTP — no password on file.</p>

      <div className="bg-white border border-[#2B1B0C] rounded-2xl p-5 sm:p-6 mb-6">
        <Row icon={User} label="Name" value={user.name} />
        <Row icon={Phone} label="Phone" value={`+91 ${user.phone.replace(/^\+91/, '')}`} />
        <Row icon={Cake} label="Date of Birth" value={user.dob ? formatDate(user.dob) : 'Not added yet'} />
        {latestOrder && (
          <Row
            icon={MapPin}
            label="Last used address"
            value={`${latestOrder.shippingAddress.line1}, ${latestOrder.shippingAddress.city}, ${latestOrder.shippingAddress.state} ${latestOrder.shippingAddress.pincode}`}
          />
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/orders"
          className="flex-1 flex items-center justify-center gap-2 bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-lg px-6 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#9C5A26] hover:text-[#2B1B0C] transition-all duration-200"
        >
          <PackageSearch className="w-4 h-4" />
          View Orders
        </Link>
        <button
          onClick={() => {
            logout();
            router.push('/');
          }}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-[#2B1B0C] border border-[#2B1B0C] rounded-lg px-6 py-3 font-body font-bold uppercase tracking-widest text-xs hover:bg-[#F6E4C2] transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
      </div>
    </div>
  );
}
