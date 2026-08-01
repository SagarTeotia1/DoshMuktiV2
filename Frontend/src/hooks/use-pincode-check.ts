'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';

type ServiceabilityState = 'idle' | 'checking' | 'serviceable' | 'not-serviceable' | 'error';

export function usePincodeCheck(pincode: string) {
  const [state, setState] = useState<ServiceabilityState>('idle');
  const lastChecked = useRef('');

  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) {
      setState('idle');
      return;
    }
    if (lastChecked.current === pincode) return;
    lastChecked.current = pincode;

    setState('checking');
    let cancelled = false;

    api
      .get<{ serviceable: boolean }>(`/api/serviceability?pincode=${pincode}`)
      .then((data) => {
        if (!cancelled) setState(data.serviceable ? 'serviceable' : 'not-serviceable');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [pincode]);

  return {
    isChecking: state === 'checking',
    isServiceable: state === 'serviceable',
    serviceable: state === 'serviceable' ? true : state === 'not-serviceable' ? false : null,
  };
}
