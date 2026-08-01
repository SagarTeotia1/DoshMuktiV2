'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gem } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';
import { setToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { token } = await api.post<{ token: string }>('/api/auth/admin/login', { email, password });
      setToken(token);
      router.push('/');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.error : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Gem className="w-6 h-6 text-[#9C5A26]" />
          <span className="font-heading font-black text-xl text-slate-900">Doshhmukti Admin</span>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg shadow-card p-6 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:border-transparent focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#9C5A26] focus:border-transparent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-2 bg-[#9C5A26] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#6B3D19] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
