# Doshhmukti — DoshMuktiV2

Spiritual/wellness D2C storefront (Rudraksha, pyrite, attars, dosh-mukti products) built as a split architecture: a Fastify API backend, a Next.js storefront, and a Next.js admin panel — talking to each other only over REST, no shared code, no monorepo tooling.

## Architecture

```
DoshMuktiV2/
├── Backend/     Fastify REST API (port 4000) — owns Postgres, Redis, R2, Razorpay, Delhivery, Resend, MSG91
├── Frontend/    Next.js 15 storefront (port 3000) — zero DB access, talks to Backend over HTTP only
└── Admin/       Next.js 15 admin panel (port 3001) — zero DB access, talks to Backend over HTTP only
```

Three independent Node projects, each with its own `package.json` and `.env`. The contract between each Next.js app and Backend is the REST API, documented per-module in `Backend/src/modules/*`, mirrored as Zod/TS types in `Frontend/src/types/api.types.ts` and `Admin/src/types/api.types.ts`. Changing a response shape means editing both sides in the same commit — see `docs/PATTERNS.md` § "Why No Shared Package."

## Tech Stack

| Layer | Backend | Frontend | Admin |
|---|---|---|---|
| Framework | Fastify 5 | Next.js 15 (App Router) | Next.js 15 (App Router) |
| Language | TypeScript strict | TypeScript strict | TypeScript strict |
| Validation | Zod (route schemas) | Zod (form + response parsing) | Zod + `react-hook-form` |
| DB | Prisma 5 → Neon Postgres | — (no DB access) | — (no DB access) |
| Cache | Upstash Redis | — | — |
| Storage | Cloudflare R2 (`@aws-sdk/client-s3`) | — | uploads via Backend `/admin/upload` |
| Payments | Razorpay Node SDK | `razorpay` checkout.js (client-side) | — |
| Logistics | Delhivery Partner API | — | — |
| Auth | Phone OTP (customers, MSG91) · email+password JWT (admin) | JWT cookie, `Authorization: Bearer` | JWT cookie, `Authorization: Bearer` |
| Email | Resend | — | — |
| AI chat | Groq (`llama-3.3-70b-versatile`) | — | — |
| Data fetching | — | TanStack Query | TanStack Query, `@tanstack/react-table` |
| Charts | — | — | `recharts` (dashboard sales trend) |
| Styling | — | Tailwind CSS, "Temple Warmth" bronze/cream system | Tailwind CSS, neutral slate + bronze accent |
| Hosting | GCP Cloud Run, `min-instances=1` | GCP Cloud Run | GCP Cloud Run, `min-instances=0` |

## Features

### Storefront (Frontend)
- Browsable catalog: purpose/category filters, grid and list views, search, sort.
- Product detail pages: variants, image gallery, offers, cashback badges, benefits, how-to-wear, reviews, related products.
- Cart (guest, session-based via `x-session-id`) → **login required at checkout** (phone OTP) → shipping address + live pincode serviceability check → Razorpay payment.
- Order tracking by order number (`/track/[orderNumber]`), full order history for logged-in customers (`/orders`).
- Customer profile (`/profile`): name, phone, date of birth (asked once at signup), last used shipping address.
- Acharya Madhav AI chat widget (Groq-backed).

### Admin (port 3001)
- **Dashboard**: KPI cards + 30-day sales trend chart, action-needed callouts (low stock, pending orders).
- **Products**: full CRUD, variants, image upload to R2, Sidhi/Energizing add-on pricing, description photos, how-to-use video, benefits/how-to-wear/tags editor.
- **Inventory**: stock grid with inline edit, CSV import/export, per-variant low-stock threshold.
- **Orders**: list with status filter, detail view, manual status override with audit log (`OrderStatusLog`).
- **Reviews**: moderate customer reviews.
- **Offers**: universal, reusable offers (DISPLAY / FREE_ITEM / CASHBACK / DISCOUNT), toggle per product.
- Auth: email + password → JWT (12h expiry), stored in a cookie; `middleware.ts` gates all routes except `/login`.

### Backend (API modules)
`auth` · `cart` · `chat` · `checkout` · `dashboard` · `inventory` · `offers` · `orders` · `products` · `reviews` · `serviceability` · `upload` · `wallet` · `webhooks`

Each module follows `controller.ts` (route handlers) · `service.ts` (business logic, only place Prisma is called) · `schema.ts` (Zod validation) · `routes.ts` (Fastify registration).

## Getting Started

```bash
# Backend
cd Backend
npm install
npm run db:generate
npm run db:migrate
npm run dev            # http://localhost:4000

# Frontend (separate terminal)
cd Frontend
npm install
npm run dev             # http://localhost:3000, NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# Admin (separate terminal)
cd Admin
npm install
npm run dev             # http://localhost:3001, NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### Admin login

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` (bcrypt hash — generate with `bcryptjs`, never store plaintext) in `Backend/.env`, then log in at `http://localhost:3001/login` with that email/password. Only one admin role exists today; the JWT payload already carries `role` so multiple roles are a payload change, not a re-architecture.

### Dev-mode graceful degrade

Integrations that need real credentials fall back to safe defaults in development so the app runs fully offline-of-third-parties:

| Integration | Env var | Dev-mode behavior when unset |
|---|---|---|
| Delhivery (serviceability/shipping) | `DELHIVERY_API_KEY` | Every pincode returns serviceable; shipment creation is a no-op |
| MSG91 (OTP login) | `MSG91_AUTH_KEY` | Fixed OTP `000000` accepted; sent OTP is logged as `[dev OTP] +91XXXXXXXXXX -> 000000` in the Backend console |
| Razorpay | `RAZORPAY_KEY_ID` / `SECRET` | Use test-mode keys (`rzp_test_...`) — payment modal opens in Test Mode |
| Cloudflare R2 | `R2_*` | Required for image upload; no dev fallback |
| Resend | `RESEND_API_KEY` | Required for transactional email; no dev fallback |

Full variable list: `Backend/.env.example`.

## Database Schema

Postgres via Prisma, single schema at `Backend/prisma/schema.prisma` (only copy — Frontend/Admin have no schema access):

`Product` · `ProductVariant` · `StockMovement` · `Offer` · `CustomerAddress` · `OtpVerification` · `User` · `OrderSequence` · `Order` · `OrderItem` · `OrderStatusLog` · `Payment` · `Shipment` · `Review` · `Coupon` · `RewardPoint` · `WalletTransaction`

## Non-Negotiable Rules

These exist because of specific failure modes at checkout-critical-path scale — they don't change because the transport changed from a monolith to REST:

1. **Atomic stock** — every deduction is `UPDATE ... WHERE stockQuantity >= qty`, checked row count, never read-then-write.
2. **Checkout is one Serializable transaction** — stock reserve + Order + OrderItems + Payment record. Razorpay's `orders.create()` call happens **outside** the transaction — never hold a DB connection open across a network call.
3. **OrderNumber via atomic `OrderSequence` upsert** — never `COUNT(*) + 1`.
4. **Webhook signatures verified with `crypto.timingSafeEqual`** — never `===`.
5. **Webhook processing is idempotent** — `UPDATE ... WHERE status = 'PENDING'`, check `rowCount`, no-op if 0.
6. **StockMovement is append-only** — never UPDATE or DELETE a movement row.
7. **No Prisma outside `Backend/src/shared/db` and `Backend/src/modules/*/service.ts`.** Controllers never touch Prisma directly. Frontend/Admin never touch Prisma at all.
8. **No business logic in Frontend/Admin** — all computation (pricing, stock, order status transitions) lives in Backend services.
9. **Env validated with Zod at boot in Backend** — crash at startup on misconfig, never at runtime.
10. **`purpose[]` values** (`love | wealth | health | success | protection | clarity`) — single source of truth is `Backend/src/shared/constants/purposes.ts`, mirrored in `Frontend/src/lib/constants.ts`.

See `docs/PATTERNS.md` for the exact code shape of each rule, `docs/SECURITY.md` for the full threat model, `docs/SCALE.md` for load targets, `docs/DESIGN.md` for the storefront UI system.

## Auth Model

- **Storefront customers**: phone OTP only, no passwords ever stored. JWT stored client-side in a cookie, 180-day expiry. **Checkout requires login** — cart stays guest (session-based) but placing an order attaches it to the logged-in `User`.
- **Admin**: `POST /auth/admin/login` (email + password) → JWT, 12h expiry, stored in a non-httpOnly cookie. `Admin/middleware.ts` checks cookie *presence* only (a UX gate); the real authorization boundary is Backend's `verifyAdmin` on every route.
- **AI bot (future)**: `x-api-key` header, checked against a hashed key — stubbed as `verifyServiceKey` middleware, unused today.

## What's Not Built (yet)

- AI bot itself (auth stub only, `AI_BOT_SERVICE_KEY`)
- Coupons and reward points (schema exists, no routes/UI)
- Multiple admin roles/permissions (JWT payload supports it; only `role: 'admin'` exists today)
