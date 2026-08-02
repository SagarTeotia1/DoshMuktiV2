import { api } from '@/lib/api-client';
import { TestimonialsSection } from './TestimonialsSection';

interface ProductImageSet {
  thumb?: string;
  card?: string;
  full?: string;
}

interface RecentReview {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  product: { name: string; slug: string; images: ProductImageSet[] };
}

async function getRecentReviews(): Promise<RecentReview[]> {
  try {
    return await api.get<RecentReview[]>('/api/reviews/recent');
  } catch {
    return [];
  }
}

export async function TestimonialsCarousel() {
  const reviews = await getRecentReviews();
  return <TestimonialsSection reviews={reviews} />;
}
