'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 30 * 1000 } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
