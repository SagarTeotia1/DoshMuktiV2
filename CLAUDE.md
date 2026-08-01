# DoshMuktiV2 — Split Architecture

## What Changed From V1

V1 (`../` — the original DOSHHMUKTI) is a Next.js monolith: storefront, API routes, and admin all in one app, business logic in Server Actions, Prisma called directly from the app.

V1 was scoped for a ₹75k/14-day freelance brief with a single admin and guest checkout only. That brief has been superseded: ₹9L in ad spend is planned, an admin **team** is coming, an AI bot needs programmatic access to orders/inventory, and realistic load is 100–1,000 orders/day (V1's `docs/SCALE.md` already targets 10,000/day headroom — that number still holds).

A single admin editing a Next.js Server Action doesn't need an API. A team of admins plus a bot plus a storefront, all needing to read/write the same order and inventory data safely, does. That's the only reason this split exists — **not** because the monolith was badly built (it wasn't — see the V1 review: layered, `server-only` boundary enforced, atomic stock, idempotent webhooks). This is scaling a working design to a bigger org shape, not fixing a mistake.

## Three Apps, One Contract

```
DoshMuktiV2/
├── Backend/     ← Fastify REST API. Owns Postgres, Redis, R2, Razorpay, Delhivery, Resend.
├── Frontend/    ← Next.js 15 storefront. Zero DB access. Talks to Backend over HTTP only.
└── Admin/       ← Next.js 15 admin panel (port 3001). Zero DB access. Talks to Backend over HTTP only.
```

Admin is built: dashboard (KPIs + sales trend), product CRUD + variants + image upload, inventory (stock edit + CSV import/export), orders (list + detail + status override). AI bot is still not built — Backend's `verifyServiceKey` stub is ready for it, unused today.

No monorepo tooling (no npm workspaces, no shared package). Three independent Node projects. The contract between each Next.js app and Backend is the REST API, documented per-module in Backend, and mirrored as Zod/TS types in `Frontend/src/types/api.types.ts` and `Admin/src/types/api.types.ts`. This is an intentional, documented tradeoff — see `docs/PATTERNS.md` § "Why No Shared Package."

## Tech Stack

| Layer | Backend | Frontend | Admin |
|---|---|---|---|
| Framework | Fastify 5 | Next.js 15 (App Router) | Next.js 15 (App Router) |
| Language | TypeScript strict | TypeScript strict | TypeScript strict |
| Validation | Zod (route schemas) | Zod (form + API response parsing) | Zod + `react-hook-form` (forms), Zod (API response parsing) |
| DB | Prisma 5 → Neon Postgres | — (no DB access) | — (no DB access) |
| Cache | Upstash Redis | — (reads via Backend) | — (reads via Backend) |
| Storage | Cloudflare R2 (via `@aws-sdk/client-s3`) | — | — (uploads via Backend `/admin/upload`) |
| Payments | Razorpay Node SDK | `razorpay` checkout.js loaded client-side only | — |
| Logistics | Delhivery Partner API | — | — |
| Auth | `@fastify/jwt` (admin), API key (service-to-service, stub) | Guest-only, no auth | JWT from login stored in a cookie, `Authorization: Bearer` on every Backend call |
| Email | Resend | — | — |
| Data fetching | — | TanStack Query against Backend REST API | TanStack Query against Backend REST API |
| Tables/Forms | — | — | `@tanstack/react-table` (Products/Inventory/Orders lists), `react-hook-form` (product form) |
| Charts | — | — | `recharts` (dashboard sales trend) |
| Styling | — | Tailwind CSS, tokens from `docs/DESIGN.md` ("Temple Warmth" bronze, storefront-only) | Tailwind CSS, neutral slate + single bronze accent — denser, built for data tables, not the storefront look |
| Hosting | GCP Cloud Run (`min-instances=1`, same reasoning as V1 — no cold start on checkout) | GCP Cloud Run | GCP Cloud Run (small internal team, `min-instances=0` is fine here — no checkout-path latency concern) |

## Non-Negotiable Rules (carried over from V1, unchanged)

These rules exist because of specific failure modes at checkout-critical-path scale. They don't change because the transport changed from Server Actions to REST.

1. **Atomic stock** — every deduction is `UPDATE ... WHERE stockQuantity >= qty`, checked row count, never read-then-write.
2. **Checkout is one Serializable transaction** — stock reserve + Order + OrderItems + Payment record. Razorpay's `orders.create()` call happens **outside** the transaction — never hold a DB connection open across a network call.
3. **OrderNumber via atomic `OrderSequence` upsert** — never `COUNT(*) + 1`.
4. **Webhook signatures verified with `crypto.timingSafeEqual`** — never `===`.
5. **Webhook processing is idempotent** — `UPDATE ... WHERE status = 'PENDING'`, check `rowCount`, no-op if 0.
6. **StockMovement is append-only** — never UPDATE or DELETE a movement row.
7. **No Prisma outside `Backend/src/shared/db` and `Backend/src/modules/*/service.ts`.** Controllers never touch Prisma directly. Frontend never touches Prisma at all — if you find yourself wanting to, you're missing a Backend endpoint.
8. **No business logic in Frontend.** Frontend components render, hooks fetch, `lib/api-client.ts` calls Backend. All computation (pricing, stock, order status transitions) lives in Backend services.
9. **Env validated with Zod at boot in Backend** — crash at startup on misconfig, never at runtime. Frontend/Admin only carry `NEXT_PUBLIC_*` vars, no server-only secrets to validate.
10. **`purpose[]` values** — `love | wealth | health | success | protection | clarity` — single source of truth is `Backend/src/shared/constants/purposes.ts`, mirrored in `Frontend/src/lib/constants.ts`. Changing this list means editing both files.

See `docs/PATTERNS.md` for the exact code shape of each rule, `docs/SECURITY.md` for the full threat model, `docs/SCALE.md` for load targets, `docs/DESIGN.md` for the UI system (unchanged from V1 — storefront must look identical).

## Database Schema

Identical to V1's `prisma/schema.prisma` (`Product`, `ProductVariant`, `StockMovement`, `OrderSequence`, `Order`, `OrderItem`, `OrderStatusLog`, `Payment`, `Shipment`). Lives at `Backend/prisma/schema.prisma` — this is the only copy; Frontend has no schema.

## Folder Structure

### Backend

```
Backend/src/
├── server.ts                 # entry point — build app, listen on PORT
├── app.ts                    # Fastify instance, plugin registration (cors, helmet, rate-limit, jwt)
├── config/env.ts             # Zod env schema, crashes at boot
├── modules/
│   ├── auth/                 # POST /auth/admin/login
│   ├── products/             # GET /products, GET /products/:slug (public)
│   ├── cart/                 # Redis-only, x-session-id header
│   ├── serviceability/       # GET /serviceability?pincode= (Redis 48h cache)
│   ├── checkout/             # POST /checkout — the critical path
│   ├── webhooks/             # POST /webhooks/razorpay, /webhooks/delhivery
│   ├── orders/               # GET /orders/:orderNumber (public track); admin: list, GET/:id, PATCH/:id/status (JWT)
│   ├── inventory/            # admin: list, adjust, CSV import + export (JWT)
│   ├── upload/                # admin image upload → R2 (JWT)
│   └── dashboard/             # admin: GET /admin/dashboard (KPIs), GET /admin/dashboard/sales (30d trend) (JWT)
│   Each module: controller.ts (route handlers) · service.ts (business logic) · schema.ts (Zod) · routes.ts (registers with Fastify)
│   Admin product CRUD lives in modules/products/: GET/POST /admin/products, GET/PATCH /admin/products/:id,
│   POST /admin/products/:id/variants, PATCH /admin/variants/:id — same file, admin routes appended after public ones.
├── shared/
│   ├── db/client.ts           # Prisma singleton
│   ├── cache/{client,keys}.ts # Upstash Redis + typed key builders
│   ├── integrations/{razorpay,delhivery,r2,resend}/client.ts
│   ├── middleware/{auth,error-handler}.ts
│   ├── constants/purposes.ts
│   └── logger/pino.ts
└── jobs/                       # release-holds, tracking-sync, low-stock-digest — HTTP routes hit by Cloud Scheduler, CRON_SECRET-gated
```

### Frontend

```
Frontend/src/
├── app/                        # routes only — landing, shop, products/[slug], cart, checkout(+success), track/[orderNumber]
├── components/
│   ├── layout/                 # Navbar, Footer, AnnouncementBar
│   └── storefront/              # HeroCarousel, PurposeGrid, ProductCard, ProductCarousel, TrustBar
├── lib/
│   ├── api-client.ts            # typed fetch wrapper, NEXT_PUBLIC_BACKEND_URL, throws on !res.ok
│   ├── constants.ts              # PURPOSES, SORTS (mirrors Backend)
│   └── firebase.ts               # analytics, graceful degrade if env empty
├── hooks/                        # use-cart, use-pincode-check, use-razorpay
├── providers/query-provider.tsx
└── types/api.types.ts            # Zod schemas mirroring Backend responses
```

### Admin

```
Admin/src/
├── app/
│   ├── login/page.tsx             # public — the only route middleware.ts doesn't gate
│   ├── (dashboard)/layout.tsx     # Sidebar shell — wraps everything below
│   ├── (dashboard)/page.tsx        # Dashboard — StatCards, SalesChart, action-needed callouts
│   ├── (dashboard)/products/       # list, new/, [id]/ (edit + variants + images)
│   ├── (dashboard)/inventory/      # stock grid, CSV import/export
│   └── (dashboard)/orders/         # list (status filter), [id]/ (detail + status override)
├── components/
│   ├── layout/{Sidebar,Topbar}.tsx
│   ├── ui/{DataTable,StatCard,StatusBadge,ConfirmDialog}.tsx
│   ├── charts/SalesChart.tsx        # recharts
│   └── products/{ProductForm,VariantsPanel,ImageUploader}.tsx
├── lib/{api-client,auth,constants,utils}.ts
├── hooks/                          # use-dashboard, use-products, use-inventory, use-orders
└── types/api.types.ts
middleware.ts                        # root — redirects to /login if the admin-token cookie is absent
```

## Auth Model

- **Storefront (guest checkout)**: no auth. `x-session-id` header (nanoid, cookie-stored) scopes the cart.
- **Admin**: `POST /auth/admin/login` (email+password) → JWT via `@fastify/jwt`, 12h expiry. Admin app stores it in a non-httpOnly cookie (`dosh_admin_token`) and sends `Authorization: Bearer <token>` on every Backend call. `Admin/middleware.ts` checks cookie *presence* only — that's a UX gate (skip the login-flash), not the real authorization boundary. The real boundary is Backend's `verifyAdmin` on every route: a missing/expired/forged token still gets a 401 there regardless of what the cookie says. JWT payload carries `role` even though only one role exists today — adding roles later is a payload change, not a re-architecture.
- **AI bot (future)**: `x-api-key` header, checked against a hashed key in env/Secret Manager. Stubbed as `verifyServiceKey` middleware in `shared/middleware/auth.middleware.ts` — unused today, ready when the bot ships.

## What We Do Not Build (this pass)

- AI bot itself (auth stub only)
- Customer accounts (still guest checkout, per V1 brief)
- Coupons, reward points, multi-image carousels (V1's Phase 2 list — unchanged; schema already supports Coupons/RewardPoint, routes/UI don't exist yet)
- Multiple admin roles/permissions (JWT payload supports it; only one `role: 'admin'` exists today)

## Getting Started

```bash
# Backend
cd Backend
npm install
npm run db:generate
npm run db:migrate
npm run dev          # http://localhost:4000

# Frontend (separate terminal)
cd Frontend
npm install
npm run dev           # http://localhost:3000, NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# Admin (separate terminal)
cd Admin
npm install
npm run dev           # http://localhost:3001, NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```
