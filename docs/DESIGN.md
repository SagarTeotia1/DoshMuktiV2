# Design System — Doshhmukti ("Temple Warmth")

**Note:** this replaces an earlier Saffron-Gold Neo-Brutalist system. The brand was reworked (see V1 git history — "SEO Theme Change") to a softer bronze/copper look; this doc reflects the actual live storefront (`../../src/components/storefront/*`), not the original brief. Frontend must match this, not the old hard-edged system.

## Philosophy

Warm, soft, premium-spiritual. Rounded corners, glow shadows (not hard offsets), bronze/copper accents on a warm cream paper background. Think temple brass and aged paper, not neo-brutalist blocks.

**Three laws:**
1. Border color is always `#2B1B0C` (warm ink, not pure black) when a border is used — but most elements now favor soft glow shadows over borders
2. Radius is soft everywhere — `rounded-full` for pills/buttons/nav links, `rounded-2xl` for section containers, `rounded-lg` for icon chips. Nothing is `rounded-none`.
3. Bronze (`#9C5A26`): CTAs, active states, icon accents, link hovers — never a large decorative fill

---

## Colors (use hex directly, or the Tailwind `brand.*` shortcuts already wired in `tailwind.config.ts`)

| Token | Hex | Tailwind | Use |
|---|---|---|---|
| Bronze | `#9C5A26` | `brand-gold` / `brand-bronze` | CTAs, active nav, icon accents, badges |
| Bronze Light | `#C9863F` | `brand-gold-light` | Hover fills, lighter accents |
| Bronze Deep | `#6B3D19` | `brand-gold-dark` | Pressed states, deep accents |
| Warm Ink | `#2B1B0C` | `brand-black` | Primary text, borders, button fill, footer bg |
| Warm Beige | `#E6D3AE` | `brand-bg` | Page background |
| Paper White | `#FFFDF8` | `brand-paper` | Card surfaces |
| Muted Cream | `#F6E4C2` | `brand-cream` | Hover fills, inactive backgrounds |
| Body Gray | `#6B5539` | `brand-gray` | Paragraph text |
| Muted Gray | `#8A7A63` | `brand-muted` | Meta text, placeholders, footer links |
| Footer Border | `#2A2A2A` | — | Footer section dividers |
| Dark Input BG | `#1A1A1A` | — | Footer newsletter input |
| Dark Input Border | `#3A3A3A` | — | Footer input border, social icon border |
| Dark Placeholder | `#5A5A5A` | — | Footer placeholder, bottom bar text |

---

## Typography

**Fonts:** Outfit (`font-heading`, headings) · Satoshi (`font-body`, everything else — loaded via Fontshare `@import`)

| Element | Classes |
|---|---|
| H1 hero | `font-heading text-5xl md:text-7xl font-black tracking-tighter uppercase` |
| H2 section | `font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase` |
| H3 sub | `font-heading text-2xl sm:text-3xl font-bold tracking-tight` |
| H4 card | `font-heading font-black text-[11px] sm:text-sm md:text-base uppercase tracking-tight` |
| Overline | `font-body text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] to-[0.25em] text-[#9C5A26]` |
| Body | `font-body text-base md:text-lg leading-relaxed text-[#6B5539]` |
| Body small | `font-body text-xs sm:text-sm text-[#8A7A63]` |
| Button label | `font-body text-xs font-bold uppercase tracking-widest` |
| Nav link | `font-body text-xs font-bold uppercase tracking-[0.12em] lg:tracking-[0.15em]` |

---

## Borders & Radius

- Border color when used: `border-[#2B1B0C]`
- Section/card radius: `rounded-2xl` (uses CSS var `--radius: 0.9rem`)
- Pills (buttons, nav links, badges): `rounded-full`
- Icon chips: `rounded-lg`
- No sharp corners anywhere — this is the opposite of the old neo-brutalist system

---

## Shadows (soft bronze-tinted glow — defined in `tailwind.config.ts` as `shadow-neo-*`)

| Class | Value | Use |
|---|---|---|
| `shadow-neo-sm` | `0 2px 8px rgba(107,61,25,0.10)` | Scrolled navbar, small lifts |
| `shadow-neo-md` | `0 6px 16px rgba(107,61,25,0.12)` | Active nav pill, hover lifts |
| `shadow-neo-lg` | `0 10px 26px rgba(107,61,25,0.14)` | Cards on hover |
| `shadow-neo-xl` | `0 16px 38px rgba(107,61,25,0.16)` | Larger hover cards |
| `shadow-neo-2xl` | `0 22px 50px rgba(107,61,25,0.18)` | Hero/feature cards |
| `shadow-neo-gold-sm` | `0 4px 14px rgba(201,134,63,0.30)` | Bronze CTA hover |
| `shadow-neo-gold-md` | `0 8px 22px rgba(201,134,63,0.32)` | Bronze CTA hover, larger |

**`.neo-card` class** (add to product cards, feature cards):
```css
.neo-card { transition: transform 0.25s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.25s cubic-bezier(0.2,0.8,0.2,1), background-color 0.2s ease; }
.neo-card:hover { transform: translateY(-5px) translateX(-2px); box-shadow: 0 18px 40px rgba(107,61,25,0.20); }
```

---

## Layout

```
Container: max-w-7xl mx-auto px-4 sm:px-6 lg:px-12
Section vertical: py-10 sm:py-14 md:py-20 lg:py-24
Product grid: grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4
```

---

## Buttons

**Primary (ink → bronze hover):**
```
bg-[#2B1B0C] text-white border border-[#2B1B0C] rounded-full px-6 sm:px-8 py-3 sm:py-4
font-body font-bold uppercase tracking-widest text-xs sm:text-sm
hover:bg-[#9C5A26] hover:text-[#2B1B0C]
transition-all duration-200
```

**Secondary (white → cream hover):**
```
bg-white text-[#2B1B0C] border border-[#2B1B0C] rounded-full px-6 sm:px-8 py-3 sm:py-4
font-body font-bold uppercase tracking-widest text-xs sm:text-sm
hover:bg-[#F6E4C2]
transition-all duration-200
```

---

## Cards

**Product card:** `bg-white border border-[#2B1B0C] rounded-2xl flex flex-col neo-card overflow-hidden`
- Image area: `aspect-[4/5] bg-[#F6E4C2] relative overflow-hidden product-image-container` (`.product-image-container img` zooms `scale(1.06)` on hover)
- Info: `p-3 sm:p-4 flex flex-col gap-1.5 flex-1`

**Purpose grid** (`PurposeGrid.tsx` pattern — bordered cell grid, not gapped cards):
```
grid grid-cols-2 md:grid-cols-3 rounded-2xl overflow-hidden border-t border-l border-[#2B1B0C]
```
Each cell: `border-b border-r border-[#2B1B0C] bg-[#E6D3AE] p-4 sm:p-7 min-h-[150px] sm:min-h-[200px]`, per-purpose subtle hover tint via inline `backgroundColor` style, decorative low-opacity circles + large decorative index number in the corner.

---

## Inputs

**Light:**
```
bg-white border border-[#2B1B0C] rounded-lg px-4 py-3 text-sm
focus:ring-2 focus:ring-[#9C5A26] focus:outline-none
placeholder:text-[#8A7A63]
```

**Dark (footer newsletter):**
```
bg-[#1A1A1A] border-0 rounded-full px-4 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm text-[#E6D3AE]
focus:outline-none focus:ring-0
placeholder:text-[#5A5A5A]
```
(footer input+button share one `rounded-full overflow-hidden` container with a `border border-[#3A3A3A]`)

---

## Navbar

```
sticky top-0 z-50 border-b border-[#2B1B0C] bg-[#E6D3AE]/90 backdrop-blur-md transition-all duration-300
```
On scroll (`scrollY > 20`): `bg-[#E6D3AE]/96 backdrop-blur-lg shadow-neo-sm`
- Height: `h-14 sm:h-16`
- Logo: `Gem` icon `text-[#9C5A26] group-hover:rotate-12`, wordmark `font-heading font-black tracking-tighter text-[#2B1B0C]`
- Nav link (pill): `px-4 lg:px-5 py-2 rounded-full border transition-all duration-200`
  - active: `bg-[#9C5A26] text-[#2B1B0C] border-[#2B1B0C] shadow-neo-md`
  - inactive: `border-transparent hover:border-[#2B1B0C] hover:shadow-neo-md hover:-translate-y-0.5`
- Cart badge: `bg-[#9C5A26] text-[#2B1B0C] border border-[#2B1B0C] rounded-full w-4 h-4 sm:w-5 sm:h-5 text-[9px] sm:text-[10px] font-bold`
- Icon buttons: `p-1.5 sm:p-2 rounded-full hover:bg-[#F6E4C2] transition-colors`

---

## Footer

```
bg-[#2B1B0C] text-[#E6D3AE]
```
Background image: `radial-gradient(circle at 85% 20%, rgba(156,90,38,0.12), transparent 35%), radial-gradient(circle at 12% 75%, rgba(157,138,236,0.12), transparent 34%)`
Newsletter section: `border-b border-[#2A2A2A]`
Column headings: `text-[10px] font-bold uppercase tracking-[0.2em] text-[#9C5A26]`
Links: `text-xs text-[#8A7A63] hover:text-[#9C5A26] transition-colors`
Social icon: `w-9 h-9 rounded-full border border-[#3A3A3A] hover:border-[#9C5A26] hover:text-[#9C5A26]`

---

## Background (page body)

```css
body {
  background-color: #E6D3AE;
  background-image:
    radial-gradient(circle at 12% 8%,  rgba(156, 90, 38, 0.09), transparent 35%),
    radial-gradient(circle at 90% 85%, rgba(107, 61, 25, 0.07), transparent 35%);
}
```

`.app-shell` adds two fixed blurred blobs (top-right bronze `rgba(156,90,38,0.20)` blur-80, bottom-left `rgba(107,61,25,0.14)` blur-80) — see `globals.css` in Frontend.

---

## Animations

- `animate-fade-in-up` — 0.7s ease-out, from `opacity:0 translateY(30px)`
- `animate-marquee` — 25s linear infinite (announcement bar)
- `animate-float` — 3s float ±10px
- `animate-pulse-glow` — 2s bronze glow pulse
- `hide-scrollbar` — removes scrollbar on horizontal scroll rows
- Product image zoom: `.product-image-container img` → `scale(1.06)` on container hover, 500-600ms ease

**Transition standards:** buttons/nav `transition-all duration-200`, cards `transition-all duration-250-300`, color-only `transition-colors`.

---

## Z-Index

| Value | Element |
|---|---|
| `z-0` | Background decorative elements |
| `z-10` | Foreground content over decorative circles |
| `z-50` | Navbar, mobile menu, search overlay |
