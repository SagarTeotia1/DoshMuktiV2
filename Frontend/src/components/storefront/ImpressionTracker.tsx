'use client';

import { useEffect, useRef } from 'react';
import { trackViewItemList } from '@/lib/firebase';
import type { Product } from '@/types/api.types';

// Renders nothing — fires GA4's view_item_list once per mount so a rail's impression
// is counted exactly once, not once per card. useRef instead of a dependency-array
// trick because `products` is a new array reference on every parent render.
export function ImpressionTracker({ listName, products }: { listName: string; products: Product[] }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || products.length === 0) return;
    fired.current = true;
    trackViewItemList(
      listName,
      products.map((p) => ({ id: p.id, name: p.name, price: p.basePrice }))
    );
  }, [listName, products]);

  return null;
}
