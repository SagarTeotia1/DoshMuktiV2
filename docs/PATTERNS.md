# Code Patterns — DoshMuktiV2

Copy these exactly. Do not invent variations. These are V1's `docs/PATTERNS.md` patterns re-expressed for a Fastify Backend + Next.js Frontend split — the business logic is unchanged, only the transport layer is different.

---

## Why No Shared Package

Two Node projects, no npm workspace, no shared `types` package. The contract is the REST API + Zod schemas duplicated on each side (`Backend/src/modules/*/schema.ts` and `Frontend/src/types/api.types.ts`).

This is deliberate, not laziness: a shared package adds build-order coupling (Frontend can't build until the shared package builds), versioning overhead, and a third repo/publish step — real cost for a 2-app system with one team. Revisit when a third consumer (Admin app, AI bot) makes keeping schemas in sync by hand genuinely painful — at that point, extract `packages/shared-types` with npm workspaces.

Until then: **when you change a Backend response shape, grep the Frontend for the matching Zod schema and update it in the same commit.**

---

## Backend: Fastify Route Module (Standard Shape)

Every module is `controller.ts` + `service.ts` + `schema.ts` + `routes.ts`. Controllers never call Prisma directly — only services do.

```typescript
// Backend/src/modules/products/schema.ts
import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  purpose: z.enum(['love', 'wealth', 'health', 'success', 'protection', 'clarity']).optional(),
  sort: z.enum(['newest', 'popular', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
```

```typescript
// Backend/src/modules/products/service.ts
import { db } from '../../shared/db/client';
import { redis } from '../../shared/cache/client';
import { cacheKeys } from '../../shared/cache/keys';
import type { ListProductsQuery } from './schema';

export async function listProducts(query: ListProductsQuery) {
  const key = cacheKeys.productsList(query);
  const cached = await redis.get(key);
  if (cached) return cached;

  const where = {
    status: 'ACTIVE' as const,
    ...(query.purpose ? { purpose: { has: query.purpose } } : {}),
  };
  const orderBy =
    query.sort === 'price_asc' ? { basePrice: 'asc' as const }
    : query.sort === 'price_desc' ? { basePrice: 'desc' as const }
    : query.sort === 'popular' ? { featured: 'desc' as const }
    : { createdAt: 'desc' as const };

  const [products, total] = await Promise.all([
    db.product.findMany({
      where, orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { variants: { where: { isActive: true } } },
    }),
    db.product.count({ where }),
  ]);

  const result = { products, total, pages: Math.ceil(total / query.limit), page: query.page };
  await redis.set(key, result, { ex: 60 * 5 });
  return result;
}
```

```typescript
// Backend/src/modules/products/controller.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { listProductsQuerySchema } from './schema';
import { listProducts } from './service';

export async function listProductsHandler(req: FastifyRequest, reply: FastifyReply) {
  const parsed = listProductsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid query', details: parsed.error.flatten().fieldErrors });
  }
  const result = await listProducts(parsed.data);
  return reply.send(result);
}
```

```typescript
// Backend/src/modules/products/routes.ts
import type { FastifyInstance } from 'fastify';
import { listProductsHandler } from './controller';

export async function productsRoutes(app: FastifyInstance) {
  app.get('/products', listProductsHandler);
}
```

---

## Backend: Admin/Protected Route

```typescript
// Backend/src/modules/inventory/routes.ts
import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../shared/middleware/auth.middleware';
import { adjustStockHandler } from './controller';

export async function inventoryRoutes(app: FastifyInstance) {
  app.post('/admin/inventory/adjust', { preHandler: verifyAdmin }, adjustStockHandler);
}
```

```typescript
// Backend/src/shared/middleware/auth.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';

export async function verifyAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}

// Stub for the future AI bot — unused today, wired for when it ships
export async function verifyServiceKey(req: FastifyRequest, reply: FastifyReply) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.AI_BOT_SERVICE_KEY) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
```

---

## Atomic Stock Reservation (unchanged from V1)

```typescript
// Backend/src/modules/checkout/service.ts
async function reserveStock(
  tx: Prisma.TransactionClient,
  items: Array<{ variantId: string; quantity: number }>
) {
  const sorted = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
  for (const item of sorted) {
    const updated = await tx.$executeRaw`
      UPDATE "ProductVariant"
      SET "stockQuantity" = "stockQuantity" - ${item.quantity}
      WHERE id = ${item.variantId} AND "stockQuantity" >= ${item.quantity} AND "isActive" = true
    `;
    if (updated === 0) throw new InsufficientStockError(item.variantId);
  }
}

export async function checkout(input: CheckoutInput) {
  const order = await db.$transaction(async (tx) => {
    await reserveStock(tx, input.items);
    const orderNumber = await nextOrderNumber(tx);
    const order = await tx.order.create({ data: { orderNumber, ...input } });
    await tx.payment.create({ data: { orderId: order.id, razorpayOrderId: 'pending', amount: order.total, status: 'PENDING' } });
    return order;
  }, { isolationLevel: 'Serializable' });

  // Razorpay call OUTSIDE the transaction — network call inside a DB tx holds the connection open
  const razorpayOrder = await razorpay.orders.create({ amount: Number(order.total) * 100, currency: 'INR' });
  await db.payment.update({ where: { orderId: order.id }, data: { razorpayOrderId: razorpayOrder.id } });

  return { order, razorpayOrderId: razorpayOrder.id };
}
```

---

## Idempotent Webhook Handler

```typescript
// Backend/src/modules/webhooks/controller.ts
export async function razorpayWebhookHandler(req: FastifyRequest, reply: FastifyReply) {
  const rawBody = req.rawBody as string; // captured via addContentTypeParser, see app.ts
  const signature = req.headers['x-razorpay-signature'] as string;

  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const sigBuf = Buffer.from(signature ?? '', 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return reply.code(401).send('Invalid signature');
  }

  reply.code(200).send('OK'); // ack before processing — Razorpay retries if no 200 within 5s

  const event = JSON.parse(rawBody);
  if (event.event === 'payment.captured') {
    const { order_id, id: paymentId } = event.payload.payment.entity;
    const updated = await db.$executeRaw`
      UPDATE "Payment" SET status = 'CAPTURED', "razorpayPaymentId" = ${paymentId}, "verifiedAt" = NOW()
      WHERE "razorpayOrderId" = ${order_id} AND status = 'PENDING'
    `;
    if (updated === 0) return; // already processed
    await fulfillOrder(order_id);
  }
}
```

**Fastify note:** register a raw-body content parser for the webhook route specifically — do not use the default JSON parser, you need the raw bytes for HMAC verification.

---

## Frontend: API Client (Standard Shape)

```typescript
// Frontend/src/lib/api-client.ts
const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

interface ApiError { error: string; details?: Record<string, string[]> }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as ApiError;
    throw new Error(body.error);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
```

```typescript
// Frontend/src/hooks/use-cart.ts — TanStack Query wrapping api-client
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { getSessionId } from '@/lib/session';

export function useCart() {
  const qc = useQueryClient();
  const sessionId = getSessionId();

  const cart = useQuery({
    queryKey: ['cart', sessionId],
    queryFn: () => api.get<CartResponse>('/cart', { headers: { 'x-session-id': sessionId } } as any),
  });

  const addItem = useMutation({
    mutationFn: (item: { variantId: string; quantity: number }) =>
      api.post('/cart/items', item),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart', sessionId] }),
  });

  return { cart, addItem };
}
```

---

## Server Component Fetch (Frontend — no client-side waterfall)

```typescript
// Frontend/src/app/shop/page.tsx
import { api } from '@/lib/api-client';

export default async function ShopPage({
  searchParams,
}: { searchParams: Promise<{ purpose?: string; sort?: string; page?: string }> }) {
  const sp = await searchParams;
  const data = await api.get<PaginatedProducts>(
    `/products?${new URLSearchParams({ purpose: sp.purpose ?? '', sort: sp.sort ?? 'newest', page: sp.page ?? '1' })}`
  );
  return <ProductGrid data={data} />;
}
```

---

## Error Response Shape (identical across every Backend route)

```typescript
{ error: string }
{ error: string, details: Record<string, string[]> }       // 400, Zod errors
{ error: string, code: 'OUT_OF_STOCK', variantId: string }  // 409, stock
```

---

## What's Banned

| Pattern | Use Instead |
|---|---|
| Prisma call in a Backend controller | Controller → service → Prisma |
| Prisma import anywhere in Frontend | `lib/api-client.ts` call to Backend |
| `$executeRawUnsafe(string + var)` | `$executeRaw` tagged template |
| Price from client payload | Load price from DB in Backend service |
| `console.log` in production | `pino` (Backend) / structured Next.js logging (Frontend) |
| Hard delete | Soft delete (`status = ARCHIVED` / `CANCELLED`) |
| `==` for status comparison | Always `===` |
| Business logic in a Frontend component | Move it to a Backend service; Frontend only renders |
| New Backend response field without updating `Frontend/src/types/api.types.ts` | Update both in the same commit |
