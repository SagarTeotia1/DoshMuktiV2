# Security Model — DoshMuktiV2

Same threats as V1 (`../docs/SECURITY.md`), plus a new one: Backend is now a network-reachable service with multiple clients (Frontend today, Admin app and AI bot later), so it needs its own auth layer instead of relying on Next.js session cookies.

## Threat Surface

| Surface | Threats | Mitigations |
|---|---|---|
| Backend↔Frontend | Unauthenticated write access | Public routes are read-only or guest-scoped (cart, checkout, track); all admin routes require JWT |
| Backend CORS | Arbitrary origin calling the API | `@fastify/cors` allowlist = Frontend origin only (env-configured), no wildcard |
| Razorpay webhook | Forged requests, replay | `timingSafeEqual` HMAC verify on raw body, idempotent processing |
| Admin routes | Unauthorized access | `verifyAdmin` preHandler (JWT) on every `/admin/*` route — no exceptions |
| Future AI bot access | Overly broad access if bolted on carelessly | `verifyServiceKey` middleware stub, scoped to specific routes only when the bot ships — never given the admin JWT |
| Checkout API | Oversell, price manipulation | Atomic SQL stock update, server-side price lookup only, never trust client-sent price |
| Upload endpoint | Malicious files, path traversal | Mime-type check, 10MB limit, nanoid filename, admin JWT required |
| Cron routes | Unauthorized execution | `Authorization: Bearer CRON_SECRET`, same as V1 |
| Cart API | Cart poisoning | Server validates quantity > 0, prices from DB, `x-session-id` is opaque (nanoid), not guessable |

## Auth Model

### Storefront traffic (guest — no login)
No JWT. `x-session-id` header (nanoid, 21 chars, set as a non-httpOnly cookie by Frontend so it survives reloads, sent on every cart/checkout call). Scopes the Redis cart key only — it is not a security boundary, just a cart identifier. Never used to authorize anything beyond "which cart."

### Admin (future Admin app — Backend is ready now)
```
POST /auth/admin/login  { email, password }
  → verify against ADMIN_EMAIL / bcrypt(ADMIN_PASSWORD_HASH) (team: each admin gets a row once multi-admin ships;
     today, single admin via env, same as V1)
  → @fastify/jwt sign: { sub: email, role: 'admin', iat, exp }
  → all /admin/* routes: preHandler verifyAdmin → req.jwtVerify()
```
JWT payload includes `role` from day one even with one admin — adding a second role later is a payload/DB change, not new middleware.

### AI bot (future — stubbed, not wired to any route yet)
```
x-api-key: <service key, stored hashed in Secret Manager>
  → verifyServiceKey middleware checks header against env, constant-time compare
  → when the bot ships: scope it to specific routes (e.g. read orders, read inventory) —
     never give it the admin JWT or blanket access
```

## Per-Route Requirements

### `POST /checkout`
```
✅ Zod validate: name, email, phone, address, pincode, items (quantity > 0)
✅ Pincode serviceability check before Razorpay order (Redis cached)
✅ Price loaded from DB — NEVER trust client-sent price
✅ Stock reservation: Postgres tx, UPDATE WHERE stockQuantity >= quantity
✅ Razorpay order created with server-computed amount, OUTSIDE the DB tx
✅ Rate limit: 10 req/min per IP (@fastify/rate-limit)
```

### `POST /webhooks/razorpay`
```
✅ Raw body captured via custom content-type parser (not the default JSON parser)
✅ HMAC-SHA256 with timingSafeEqual — buffers must be equal length before compare
✅ Return 200 immediately after verify, process async
✅ Idempotent: UPDATE Payment WHERE status='PENDING', check rowCount === 1
```

### `POST /admin/upload`
```
✅ verifyAdmin preHandler
✅ Accept only: image/jpeg, image/png, image/webp, image/gif
✅ Max size: 10MB (Fastify bodyLimit + explicit check)
✅ Filename = nanoid() + extension — never originalFilename
✅ sharp strips EXIF
```

### `/admin/*` (all routes)
```
✅ verifyAdmin preHandler — no exceptions
✅ All inputs Zod validated before any DB operation
✅ DELETE = archive (status = ARCHIVED), never hard delete
```

### `GET /products` (public)
```
✅ Only status = ACTIVE
✅ Zod validate query params, defaults applied
✅ page clamped 1–999, limit clamped max 100
```

## Zod Patterns — Use These Exactly (unchanged from V1)

```typescript
z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number')   // phone
z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits')             // pincode
z.string().min(2).max(200).regex(/^[a-z0-9-]+$/)                    // slug
z.string().email().toLowerCase()                                     // email
z.array(z.enum(['love','wealth','health','success','protection','clarity'])) // purpose
z.number().int().min(1).max(99)                                      // cart quantity
z.coerce.number().int().min(1).max(999).default(1)                   // page
```

## SQL Injection Prevention

**Rule unchanged: every DB interaction through Prisma ORM or tagged template literals, only inside `Backend/src/shared/db` and `Backend/src/modules/*/service.ts`.**

```typescript
// ✅ SAFE
db.product.findMany({ where: { slug } })
db.$executeRaw`UPDATE "ProductVariant" SET "stockQuantity" = ${qty} WHERE id = ${id}`

// ❌ BANNED
db.$executeRawUnsafe(`SELECT * WHERE slug = '${slug}'`)
```

## XSS Prevention

- Frontend renders all user-facing text via React (JSX escapes by default)
- `dangerouslySetInnerHTML` banned — no exceptions
- Product descriptions: plain text, `<p>{description}</p>`

## Secrets Management

| Secret | Lives In | Notes |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Backend only | Never sent to Frontend |
| `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Backend only | Never in Frontend bundle |
| `JWT_SECRET` | Backend only | Signs admin JWTs |
| `AI_BOT_SERVICE_KEY` | Backend only (stub, unused today) | For future bot |
| `CRON_SECRET` | Backend only | Gates `/jobs/*` routes |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Frontend, intentionally public | Checkout.js needs it client-side |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend, intentionally public | Just the API base URL |
| Firebase `NEXT_PUBLIC_*` | Frontend, intentionally public | Analytics keys, read-only |

**Never commit `.env` / `.env.local` in either app.**
**Pre-deploy check:** `grep -r "RAZORPAY_KEY_SECRET" Frontend/.next/` → zero results. Backend secrets should never even be *available* to Frontend's build, but grep it anyway.

## Rate Limiting (`@fastify/rate-limit` on Backend)

| Route | Limit |
|---|---|
| `POST /checkout` | 10/min per IP |
| `POST /auth/admin/login` | 5/min per IP |
| `GET /serviceability` | 30/min per IP |
| `/admin/*` | No limit (small internal team) |

## Security Headers

Backend (`@fastify/helmet`) and Frontend (`next.config.ts`) both set:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Pre-Deploy Security Checklist

- [ ] `grep -r "RAZORPAY_KEY_SECRET\|JWT_SECRET\|DATABASE_URL" Frontend/.next/` → zero results
- [ ] Backend CORS rejects a request from a non-allowlisted origin
- [ ] Webhook with wrong signature → 401, zero DB writes
- [ ] Checkout with negative quantity → 400
- [ ] Checkout with non-existent variantId → 400
- [ ] `/admin/*` without JWT → 401
- [ ] Upload with `.php` file → rejected
- [ ] Concurrent checkout for last unit → exactly 1 succeeds
- [ ] `x-api-key` stub route (if any wired for testing) rejects missing/wrong key
