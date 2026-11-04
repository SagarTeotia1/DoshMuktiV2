import { api } from '@/lib/api-client';
import type { StoryImage } from '@/components/storefront/BrandStory';

// Brand story photo slots, in layout order:
//   0 = large arch (back), 1 = large framed print (front), 2 = small round medallion (front-most).
// Homepage shows these three as-is. On a product page the current product takes over the slot
// whose category it shares, so the same story shows with that product in its own category's place.
const SLOTS = [
  { slug: 'divya-hawan-powder', imageIndex: 0 }, // DoshMukti Special
  { slug: 'aries-zodiac-bracelet', imageIndex: 2 }, // Bracelets · Rashi Collections — 3rd image
  { slug: 'mulank-4-bracelet', imageIndex: 4 }, // Bracelets · Mulank Bracelets — 5th image
] as const;

const FALLBACK_SLOT = 2;

interface SlotData {
  slug: string;
  categories: string[];
  image: StoryImage | null;
}

export interface CurrentProductForStory {
  slug: string;
  name: string;
  categories: string[];
  image: string | null;
}

async function fetchSlot({ slug, imageIndex }: { slug: string; imageIndex: number }): Promise<SlotData> {
  try {
    const data = await api.get<{ product: { name: string; categories: string[]; images: Array<{ card: string }> } }>(
      `/api/products/${slug}`,
    );
    // Falls back to the first photo if the product has fewer than imageIndex + 1.
    const img = data.product.images[imageIndex] ?? data.product.images[0];
    return {
      slug,
      categories: data.product.categories,
      image: img ? { src: img.card, alt: data.product.name } : null,
    };
  } catch {
    return { slug, categories: [], image: null };
  }
}

/** Slot whose categories overlap the product's the most; ties go to the later (smaller) slot. */
function pickSlot(slots: SlotData[], categories: string[]): number {
  let best = -1;
  let bestScore = 0;
  slots.forEach((slot, i) => {
    const score = slot.categories.filter((c) => categories.includes(c)).length;
    if (score > 0 && score >= bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best === -1 ? FALLBACK_SLOT : best;
}

/** [arch, framed print, medallion]. With `current`, that product replaces its category's slot. */
export async function getStoryImages(current?: CurrentProductForStory): Promise<StoryImage[]> {
  const slots = await Promise.all(SLOTS.map(fetchSlot));
  const images = slots.map((s) => s.image);

  // A story product's own page keeps its configured photo — nothing to replace.
  if (current?.image && !slots.some((s) => s.slug === current.slug)) {
    images[pickSlot(slots, current.categories)] = { src: current.image, alt: current.name };
  }
  return images.filter((i): i is StoryImage => i !== null);
}
