# Doshhmukti — DoshMuktiV2

Spiritual/wellness D2C storefront (Rudraksha, gemstones, pyrite, attars, dosh-mukti products) built as a split architecture: a Fastify API backend, a Next.js storefront, and a Next.js admin panel — talking to each other only over REST, no shared code, no monorepo tooling.

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
| Logistics | Delhivery (serviceability, rate quote, shipment booking, pickup requests, NDR, e-way bill, tracking sync) | — | — |
| PDF | `pdfkit` (order invoices, generated on demand) | — | — |
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
- Product detail pages: variants, image gallery, offers, benefits, how-to-wear, reviews, related products.
- Cart (guest, session-based via `x-session-id`) with live pricing preview — subtotal, auto-applied offer discounts, MRP savings, free-gift line items, and a shipping estimate (origin-to-origin pre-checkout, re-quoted against the real destination pincode once entered).
- **"Buy Now"** — an isolated single-item pseudo-cart for a direct PDP purchase; merges with whatever's added to the real cart afterward instead of losing it, and clears itself once that order is paid.
- Checkout: inline phone-OTP login (no separate `/login` detour), saved-address book, live pincode serviceability, coupon code entry with suggested-offer chips, order-summary quantity controls, Razorpay payment.
- Order tracking by order number (`/track/[orderNumber]`), full order history for logged-in customers (`/orders`, excludes cancelled/abandoned attempts), downloadable PDF invoice once payment is captured.
- Customer profile (`/profile`): name, phone, date of birth (asked once at signup), last used shipping address.
- Acharya Madhav AI chat widget (Groq-backed) — recommends real products for a stated concern (love/wealth/health/...), voice input supported.

### Admin (port 3001)
- **Dashboard**: KPI cards + 30-day sales trend chart, action-needed callouts (low stock, pending orders).
- **Products**: full CRUD, variants (SKU, stock, price override, **weight in grams — feeds every shipping-rate calculation**), image upload to R2, Sidhi/Energizing add-on pricing, description photos, how-to-use video, benefits/how-to-wear/tags editor.
- **Inventory**: stock grid with inline edit, CSV import/export, per-variant low-stock threshold.
- **Orders**: list with status filter, detail view with one-step-at-a-time status progression (audit-logged in `OrderStatusLog`), refund-on-cancel, per-order **package weight override** for shipment booking, invoice download.
- **Shipping**: Delhivery rate lookup tool, waybill label fetch, NDR (failed-delivery) actions, e-way bill number entry.
- **Pickup Requests**: batch shipments awaiting courier pickup, schedule a pickup with Delhivery.
- **Coupons**: create/manage discount codes (flat/percentage, min order, usage limits, birthday-only), curate which ones surface as storefront "suggested offers."
- **Offers**: universal, reusable offers (percentage/flat discount, free gift) scoped to all products / a category / specific products, auto-applied or coupon-gated.
- **Banners** & **Homepage Sections**: manage the storefront's promotional banners and curated homepage product rails.
- **Reviews**: moderate customer reviews (approve/reject).
- **Chat Sessions**: read-only view into Acharya Madhav conversations, for support/QA.
- **GST Report**: date-range GST breakdown export (JSON/CSV) across paid orders.
- Auth: email + password → JWT (12h expiry), stored in a cookie; `middleware.ts` gates all routes except `/login`.

### Backend (API modules)
`addresses` · `auth` · `banners` · `cart` · `chat` · `checkout` · `coupons` · `dashboard` · `homepage-sections` · `inventory` · `offers` · `orders` · `pickup-requests` · `products` · `reviews` · `serviceability` · `shipping` · `upload` · `webhooks`

Each module follows `controller.ts` (route handlers) · `service.ts` (business logic, only place Prisma is called) · `schema.ts` (Zod validation) · `routes.ts` (Fastify registration).

### Background jobs (`Backend/src/jobs`)
HTTP routes hit by Cloud Scheduler, `CRON_SECRET`-gated — not long-running processes:
- `release-holds` — releases stock reserved by an order stuck at `PENDING_PAYMENT` past its reservation window.
- `tracking-sync` — polls Delhivery for waybill status updates on in-transit shipments.
- `low-stock-digest` — periodic low-stock email summary.
- `warm-cache` — pre-warms the Redis product-listing/category caches.

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
| Delhivery (serviceability/shipping/booking) | `DELHIVERY_API_KEY` | Every pincode returns serviceable; rate quote falls back to the flat `SHIPPING_FEE`; shipment creation is a no-op |
| MSG91 (OTP login) | `MSG91_AUTH_KEY` | Fixed OTP `000000` accepted; sent OTP is logged as `[dev OTP] +91XXXXXXXXXX -> 000000` in the Backend console |
| Razorpay | `RAZORPAY_KEY_ID` / `SECRET` | Use test-mode keys (`rzp_test_...`) — payment modal opens in Test Mode |
| Cloudflare R2 | `R2_*` | Required for image upload; no dev fallback |
| Resend | `RESEND_API_KEY` | Required for transactional email; no dev fallback |
| Groq (Acharya chat) | `GROQ_API_KEY` | Required for the chat widget; no dev fallback |

Full variable list: `Backend/.env.example`.

## Shipping & Package Weight

Every order — however many line items it has — ships as **one parcel on one Delhivery waybill**. The declared weight for both the pre-checkout rate quote and the actual booking is:

```
sum(item.weight × quantity) + PACKAGING_WEIGHT_GRAMS
```

`PACKAGING_WEIGHT_GRAMS` (`Backend/src/shared/constants/purposes.ts`) is a flat per-parcel allowance for box/tape/padding, added once regardless of item count — never declare less than the real packed weight, since Delhivery can re-weigh a parcel and bill the difference. An admin can override this per order (Admin → Orders → order detail → **Package Weight**) before it's booked, for a box whose real weight doesn't match the estimate. `ProductVariant.weight` (grams) drives the whole calculation and has no safe default — a product left at the schema's 500g placeholder will overstate light items; Admin's product/variant editor flags any variant still sitting at that default.

## Database Schema

Postgres via Prisma, single schema at `Backend/prisma/schema.prisma` (only copy — Frontend/Admin have no schema access):

`Product` · `ProductVariant` · `StockMovement` · `Offer` · `Coupon` · `RewardPoint` · `CustomerAddress` · `OtpVerification` · `User` · `OrderSequence` · `Order` · `OrderItem` · `OrderStatusLog` · `Payment` · `Shipment` · `PickupRequest` · `Review` · `Banner` · `HomepageSection`

## Non-Negotiable Rules

These exist because of specific failure modes at checkout-critical-path scale — they don't change because the transport changed from a monolith to REST:

1. **Atomic stock** — every deduction is `UPDATE ... WHERE stockQuantity >= qty`, checked row count, never read-then-write.
2. **Checkout is one Serializable transaction** — stock reserve + Order + OrderItems + Payment record. Razorpay's `orders.create()` call happens **outside** the transaction — never hold a DB connection open across a network call.
3. **OrderNumber via atomic `OrderSequence` upsert** — never `COUNT(*) + 1`.
4. **Webhook signatures verified with `crypto.timingSafeEqual`** — never `===`.
5. **Webhook processing is idempotent** — `UPDATE ... WHERE status = 'PENDING'`, check `rowCount`, no-op if 0.
6. **StockMovement is append-only** — never UPDATE or DELETE a movement row.
7. **No Prisma outside `Backend/src/shared/db` and `Backend/src/modules/*/service.ts`.** Controllers never touch Prisma directly. Frontend/Admin never touch Prisma at all.
8. **No business logic in Frontend/Admin** — all computation (pricing, stock, order status transitions, shipping weight) lives in Backend services, so the cart preview, checkout charge, and shipment booking can never disagree.
9. **Env validated with Zod at boot in Backend** — crash at startup on misconfig, never at runtime.
10. **`purpose[]` values** (`love | wealth | health | success | protection | clarity`) — single source of truth is `Backend/src/shared/constants/purposes.ts`, mirrored in `Frontend/src/lib/constants.ts`.

See `docs/PATTERNS.md` for the exact code shape of each rule, `docs/SECURITY.md` for the full threat model, `docs/SCALE.md` for load targets, `docs/DESIGN.md` for the storefront UI system.

## Auth Model

- **Storefront customers**: phone OTP only, no passwords ever stored. JWT stored client-side in a cookie, 180-day expiry. Checkout's login step is inline on the checkout page itself — cart stays guest (session-based) until the customer authenticates there to pay.
- **Admin**: `POST /auth/admin/login` (email + password) → JWT, 12h expiry, stored in a non-httpOnly cookie. `Admin/middleware.ts` checks cookie *presence* only (a UX gate); the real authorization boundary is Backend's `verifyAdmin` on every route.
- **AI bot (future)**: `x-api-key` header, checked against a hashed key — stubbed as `verifyServiceKey` middleware, unused today.

## What's Not Built (yet)

- AI bot itself (auth stub only, `AI_BOT_SERVICE_KEY`)
- Reward points redemption (schema + accrual exist; no customer-facing redemption flow)
- Multiple admin roles/permissions (JWT payload supports it; only `role: 'admin'` exists today)
