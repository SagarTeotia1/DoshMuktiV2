'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';
import type { WalletBalanceResponse } from '@/types/api.types';

export function useWalletBalance(phone: string) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const lastChecked = useRef('');

  useEffect(() => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setBalance(null);
      lastChecked.current = '';
      return;
    }
    if (lastChecked.current === phone) return;
    lastChecked.current = phone;

    setIsChecking(true);
    let cancelled = false;

    api
      .get<WalletBalanceResponse>(`/api/wallet/balance?phone=${phone}`)
      .then((data) => {
        if (!cancelled) setBalance(data.balance);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [phone]);

  return { balance, isChecking };
}
