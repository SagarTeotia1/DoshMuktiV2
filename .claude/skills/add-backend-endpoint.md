---
name: add-backend-endpoint
description: Scaffold a new Fastify module (controller/service/schema/routes) in Backend, consistent with existing modules. Use when adding a new API resource or endpoint to Backend.
---

# Add Backend Endpoint

Use this whenever a new resource or route is needed in `Backend/src/modules/`. Follow the exact shape below — do not invent a different structure per module. See `../../docs/PATTERNS.md` for the full worked example (`products` module).

## Steps

1. **Create the module folder**: `Backend/src/modules/<name>/` with four files:
   - `schema.ts` — Zod schemas for every input (query, body, params). Export inferred types.
   - `service.ts` — business logic, the only place allowed to call `db.*` (Prisma) or `redis.*` for this resource.
   - `controller.ts` — route handlers. Parse input with the Zod schema, return `{ error, details? }` on failure, delegate everything else to `service.ts`.
   - `routes.ts` — registers handlers on the Fastify instance. Public routes need nothing extra; protected routes add `{ preHandler: verifyAdmin }` (or `verifyServiceKey` for future bot routes).

2. **Register the module** in `Backend/src/app.ts`:
   ```typescript
   import { myModuleRoutes } from './modules/my-module/routes';
   app.register(myModuleRoutes, { prefix: '/api' });
   ```

3. **If the route reads hot-path data** (product listings, featured products, etc.), cache it — check `docs/SCALE.md` for the TTL convention and `docs/PATTERNS.md`'s `cacheKeys` pattern. Add a new key builder to `shared/cache/keys.ts`, never inline a Redis key string.

4. **If the route writes stock**, it MUST go through the atomic `UPDATE ... WHERE stockQuantity >= qty` pattern in `docs/PATTERNS.md` — never `findFirst` then `update`.

5. **If the route is admin-only**, add `preHandler: verifyAdmin` in `routes.ts` — never check auth inside the controller body.

6. **If the route changes a Backend response shape that Frontend consumes**, update `Frontend/src/types/api.types.ts` in the same change. See `docs/PATTERNS.md` § "Why No Shared Package."

7. **Rate limit** anything public and expensive (checkout, auth, serviceability) per the table in `docs/SECURITY.md`.

## Checklist Before Done

- [ ] Zod validates every input, no `any`
- [ ] Controller has zero Prisma/Redis calls — only `service.ts` does
- [ ] Error responses match `{ error: string }` / `{ error, details }` / `{ error, code, ...}` shapes
- [ ] Protected routes have `preHandler`, not an inline check
- [ ] `tsc` passes with zero errors
- [ ] If it touches stock: tested with a concurrent-request scenario (two requests, one unit left → one wins)
