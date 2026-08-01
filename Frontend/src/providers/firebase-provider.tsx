'use client';

import { useEffect } from 'react';
import { initFirebase } from '@/lib/firebase';

export function FirebaseProvider() {
  useEffect(() => {
    void initFirebase();
  }, []);

  return null;
}
