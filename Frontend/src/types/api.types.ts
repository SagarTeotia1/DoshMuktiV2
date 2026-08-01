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
  images: z.array(z.object({ thumb: z.string(), card: z.string(), full: z.string() })),
  purpose: z.array(z.string()),
  featured: z.boolean(),
  badge: z.string().nullable(),
  benefits: z.array(z.object({ title: z.string(), description: z.string() })).default([]),
  howToWear: z.array(z.string()).default([]),
  careInstructions: z.string().nullable(),
  socialProofText: z.string().nullable(),
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
  items: Array<{ variantSnapshot: { productName: string; sku: string }; quantity: number; priceAtPurchase: number }>;
  shipment: { delhiveryWaybill: string | null; status: string; trackingEvents: unknown[] } | null;
  createdAt: string;
}
