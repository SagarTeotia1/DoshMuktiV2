'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { getToken, setToken, clearToken } from '@/lib/auth';

export interface CustomerUser {
  id: string;
  name: string | null;
  phone: string;
  dob: string | null;
}

interface VerifyOtpResponse {
  token: string;
  user: CustomerUser;
}

interface AuthContextValue {
  user: CustomerUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<CustomerUser>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Mounted once at the root layout — every component that calls useAuth() shares this
// exact same state. Previously useAuth was a plain hook (its own useState per call
// site), so e.g. logging in from the checkout page's inline OTP form updated only that
// component's copy of `user`/`isAuthenticated`; the Navbar's own separate useAuth()
// call never found out, and stayed showing "logged out" until a full page reload
// re-ran every hook from scratch. A shared context fixes this everywhere at once.
export function AuthProvider({ children }: { children: ReactNode }) {
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
    } catch (err) {
      // Only a real 401 means the token is actually invalid/expired — anything else
      // (network blip, Backend restart, a transient 500) should leave the token alone
      // so the next mount just retries, instead of forcing the user through phone+OTP
      // again for a token that's still good for 180 days.
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        setUser(null);
      }
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

  async function verifyOtp(phone: string, otp: string) {
    const result = await api.post<VerifyOtpResponse>('/api/auth/otp/verify', { phone, otp });
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, sendOtp, verifyOtp, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
