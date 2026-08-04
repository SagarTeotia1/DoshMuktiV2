// Mirrors Backend/src/modules/*/schema.ts response shapes. Update both sides
// in the same commit — see docs/PATTERNS.md § "Why No Shared Package."
import { z } from 'zod';

export const productVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  attributes: z.record(z.string()),
  priceOverride: z.number().nullable(),
  stockQuantity: z.number(),
  isActive: z.boolean(),
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  category: z.string(),
  basePrice: z.number(),
  compareAtPrice: z.number().nullable(),
  images: z.array(z.object({ thumb: z.string(), card: z.string(), full: z.string() })),
  purpose: z.array(z.string()),
  featured: z.boolean(),
  badge: z.string().nullable(),
  benefits: z.array(z.object({ title: z.string(), description: z.string() })).default([]),
  howToWear: z.array(z.string()).default([]),
  careInstructions: z.string().nullable(),
  socialProofText: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  cashbackPercent: z.number().nullable(),
  descriptionImages: z.array(z.object({ thumb: z.string(), card: z.string(), full: z.string() })).default([]),
  howToUseVideoUrl: z.string().nullable(),
  sidhiPrice: z.number().nullable(),
  selfEnergizeInstructions: z.string().nullable(),
  offers: z.array(z.object({ id: z.string(), title: z.string(), type: z.string() })).default([]),
  rating: z.object({ average: z.number(), count: z.number() }).default({ average: 0, count: 0 }),
  variants: z.array(productVariantSchema),
});
export type Product = z.infer<typeof productSchema>;

export const paginatedProductsSchema = z.object({
  products: z.array(productSchema),
  total: z.number(),
  pages: z.number(),
  page: z.number(),
});
export type PaginatedProducts = z.infer<typeof paginatedProductsSchema>;

export interface CartItem {
  variantId: string;
  quantity: number;
  price: number;
  maxStock: number;
  productName: string;
  sku: string;
}

export interface CartResponse {
  sessionId: string;
  items: CartItem[];
  subtotal: number;
  updatedAt: string;
}

export interface CheckoutInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country?: string };
  items: Array<{ variantId: string; quantity: number }>;
  walletRedeem?: number;
}

export interface CheckoutResponse {
  orderId: string;
  orderNumber: string;
  rzpOrderId: string;
  amount: number;
  currency: string;
}

export interface OrderTrackingResponse {
  orderNumber: string;
  status: string;
  total: number;
  items: Array<{ variantSnapshot: { productName: string; sku: string }; quantity: number; priceAtPurchase: number }>;
  shipment: { delhiveryWaybill: string | null; status: string; trackingEvents: unknown[] } | null;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country?: string };
  createdAt: string;
}

export interface WalletBalanceResponse {
  balance: number;
}

export interface Review {
  id: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
}

export interface ProductReviewsResponse {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
}

export interface CreateReviewInput {
  orderNumber: string;
  customerPhone: string;
  productId: string;
  rating: number;
  title?: string;
  body: string;
}
