'use client';

import { useEffect, useRef } from 'react';
import { trackViewItem } from '@/lib/analytics';

// Renders nothing — fires GA4's view_item exactly once per mount (useRef guard, same
// pattern as ImpressionTracker) so a campaign page's product view is counted once per
// visit, not once per re-render.
export function ViewItemTracker({ item }: { item: { id: string; name: string; price: number; category: string } }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackViewItem(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
