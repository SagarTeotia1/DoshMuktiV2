---
name: add-frontend-page
description: Scaffold a new Next.js storefront page in Frontend, wired to Backend via api-client and styled with the DESIGN.md token system. Use when adding a new route to the storefront.
---

# Add Frontend Page

Use this whenever a new route is needed under `Frontend/src/app/`. See `../../docs/PATTERNS.md` § "Server Component Fetch" for the data-loading pattern and `../../docs/DESIGN.md` for every color/spacing/shadow token — do not invent new ones.

## Steps

1. **Data loading**: if the page needs Backend data on first paint, fetch it in the Server Component itself via `api.get<T>(...)` from `lib/api-client.ts` — do not fetch client-side and show a loading spinner for data that could be server-rendered. Reserve `useQuery`/hooks in `hooks/` for data that changes after interaction (cart, pincode check).

2. **Zero business logic in the component.** If you're computing a price, a stock check, or an order-status label, that computation belongs in Backend — call an endpoint instead. Frontend components render what Backend already decided.

3. **Styling — use `docs/DESIGN.md` exactly**:
   - Every box: `border border-[#0A0A0A]`, `rounded-none` (circles are the only exception)
   - Buttons: black fill → gold (`#EAA04B`) hover fill, per the Buttons section
   - Cards: `.neo-card` class for hover lift + shadow
   - Use hex values directly (`text-[#4A4A4A]`), not Tailwind named colors — the palette is bespoke
   - Reuse existing components in `components/layout/` and `components/storefront/` before writing a new one — check `ProductCard`, `HeroCarousel`, `PurposeGrid` first

4. **Forms** (checkout, pincode input): Zod-validate client-side for instant feedback, but never trust it — Backend re-validates everything per `docs/SECURITY.md`.

5. **Errors**: catch `api-client` throws, show via `sonner` toast — do not let an unhandled rejection reach the user as a blank screen. Wrap route segments in `error.tsx` where a whole-page failure is possible (e.g. Backend down).

6. **Analytics**: fire the relevant `trackX()` call from `lib/firebase.ts` on mount/interaction, fire-and-forget, no `await`, no try/catch needed — see `docs/PATTERNS.md`'s analytics rule (Firebase never blocks).

## Checklist Before Done

- [ ] No `db.*`/Prisma import anywhere in the file (Frontend has zero DB access)
- [ ] Server Component fetch used for first-paint data, not a client spinner
- [ ] Matches `DESIGN.md` tokens — compare visually against the equivalent V1 page if one exists
- [ ] `npm run build` passes with zero TS errors
- [ ] Manually loaded in browser, checked against V1's `../../src/app/(storefront)/` equivalent page for visual parity
