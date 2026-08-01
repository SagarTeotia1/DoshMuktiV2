import { z } from 'zod';

export const cartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export const updateQuantitySchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

export interface CartItem {
  variantId: string;
  quantity: number;
  price: number;
  maxStock: number;
  productName: string;
  sku: string;
}

export interface Cart {
  sessionId: string;
  items: CartItem[];
  updatedAt: string;
}
