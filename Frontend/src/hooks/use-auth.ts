'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { getToken, setToken, clearToken } from '@/lib/auth';

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  dob: string | null;
}

interface VerifyOtpResponse {
  token: string;
  user: CustomerUser;
}

export function useAuth() {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<CustomerUser>('/api/auth/me', { Authorization: `Bearer ${token}` }, 0);
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function sendOtp(phone: string) {
    await api.post('/api/auth/otp/send', { phone });
  }

  async function verifyOtp(phone: string, otp: string, name?: string, dob?: string) {
    const result = await api.post<VerifyOtpResponse>('/api/auth/otp/verify', { phone, otp, name, dob });
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return { user, loading, isAuthenticated: !!user, sendOtp, verifyOtp, logout, refresh };
}

export function isProfileRequired(err: unknown): boolean {
  return err instanceof ApiError && err.body.code === 'PROFILE_REQUIRED';
}
