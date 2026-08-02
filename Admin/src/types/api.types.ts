export interface ProductVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  priceOverride: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  weight: number;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  basePrice: number;
  compareAtPrice: number | null;
  images: Array<{ thumb: string; card: string; full: string }>;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  purpose: string[];
  featured: boolean;
  badge: string | null;
  benefits: Array<{ title: string; description: string }>;
  howToWear: string[];
  careInstructions: string | null;
  socialProofText: string | null;
  tags: string[];
  cashbackPercent: number | null;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProducts {
  products: Product[];
  total: number;
  pages: number;
  page: number;
}

export interface OrderItem {
  id: string;
  variantId: string;
  quantity: number;
  priceAtPurchase: number;
  variantSnapshot: { sku: string; attributes: Record<string, string>; productName: string };
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string };
  status: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  items: OrderItem[];
  payment: { status: string; razorpayPaymentId: string | null } | null;
  shipment: { delhiveryWaybill: string | null; status: string } | null;
  statusLog?: Array<{ from: string; to: string; note: string | null; createdBy: string; createdAt: string }>;
  createdAt: string;
}

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  pages: number;
  page: number;
}

export interface DashboardSummary {
  todayOrderCount: number;
  todayRevenue: number;
  ordersNeedingAction: number;
  lowStockCount: number;
}

export interface SalesTrendPoint {
  date: string;
  revenue: number;
  orderCount: number;
}

export interface InventoryProduct {
  id: string;
  name: string;
  variants: ProductVariant[];
}

export interface Review {
  id: string;
  productId: string;
  orderId: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  product: { name: string; slug: string };
}

export interface PaginatedReviews {
  reviews: Review[];
  total: number;
  pages: number;
  page: number;
}
