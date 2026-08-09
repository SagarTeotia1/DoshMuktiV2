'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Forces a prefetch of the given routes right after the landing page mounts —
 * belt-and-braces on top of <Link>'s automatic viewport prefetch, since the
 * shop tab + first few products are the most likely next click from Home. */
export function RoutePrefetcher({ routes }: { routes: string[] }) {
  const router = useRouter();

  useEffect(() => {
    routes.forEach((route) => router.prefetch(route));
  }, [router, routes]);

  return null;
}
