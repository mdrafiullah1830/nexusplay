# Incomplete Tasks — NexusPlay

> Status list of work that is planned but **not yet done**.
> Last updated: 2026-11-18 (commit `c9d5610`)

---

## 1. Raw 3D Animation Layer (main pending task)

**Goal:** Give the site a "3D animation look" using **hand-coded raw CSS 3D transforms + vanilla JS only — no animation libraries** (no GSAP, no Framer Motion, etc.).

**Status:** Design/research complete, **no code written yet**.

### Planned files

| File | Status | Purpose |
|---|---|---|
| `frontend/src/styles/_3d.scss` | ❌ not created | All raw CSS 3D styles |
| `frontend/src/components/animations.ts` | ❌ not created | IntersectionObserver reveal + hero mouse parallax |
| `frontend/src/styles/main.scss` | ⚠️ needs edit | Add `@use "3d";` |
| `frontend/src/main.ts` | ⚠️ needs edit | Import + call `initAnimations()` in `DOMContentLoaded` |
| `frontend/src/components/heroSlider.ts` | ⚠️ needs edit | Direction-aware slide transitions (`data-dir`, `is-leaving` classes) |

### Planned features (all pure CSS / vanilla JS)

1. **Hero 3D slider**
   - `perspective` on `.hero`; slides transition with `rotateY` + `translateZ` (currently opacity-only in `_hero.scss`).
   - Direction-aware: next → slide in from right / out to left; prev → mirror.
   - Staggered 3D entrance of `.hero__content` children (eyebrow, title, sub, cta) on `is-active`.
   - Mouse parallax tilt on active slide (CSS vars `--rx/--ry`, disabled on touch + reduced motion).

2. **Scroll reveal**
   - `.reveal` class + `.is-inview` toggled by IntersectionObserver.
   - Targets: `.section__head`, `.tile`, `.trend-card`, `.cat-tile`, `.p-card`, `.pd-layout`, `.cart-layout`, `.checkout-layout`, `.track-result`, `.page-message`.
   - Batch stagger delay (~70ms per element in same viewport batch).
   - MutationObserver to catch dynamically injected content (cards, page renders).

3. **Depth / lift effects**
   - Buttons (`.btn`, `.hero__btn`, `.p-card__btn`): `translateZ`/`rotateX` hover lift + layered shadow (override `pill-button` mixin's plain `scale(1.03)` hover).
   - Tiles/cards: hover `translateY(-10px) rotateX(6deg)` with `perspective` on grid containers (`.featured-grid`, `.trending-row`, `.cat-row`, `.p-rail`).
   - Enhance existing `.p-card--tilt` JS tilt (currently ±5deg → ±8deg + shadow follow).

### Hard constraints (from research — must not break)

- ❌ **Never transform `<body>` or its wrappers** — breaks `position:fixed` mobile drawer (`_base.scss:78` note; keep `body.page-enter` opacity-only).
- Fixed elements that must stay unaffected: `.mobile-menu` (`_navbar.scss:189`), `.modal` (`_pages.scss:1221`), toast container (body-level).
- Reveal hidden state must be gated behind an `.has-anim` class on `<html>` (set by JS only if `IntersectionObserver` exists) so content is never invisible without JS.
- Add `@media (prefers-reduced-motion: reduce)` opt-out in CSS **and** JS guard.

### Done-runs after coding

- [ ] `npx tsc --noEmit && npm run build` passes
- [ ] Visual check in Safari at `http://localhost:5175` (all pages: home, shop, product, cart, checkout, track, login)
- [ ] Commit + push to `main` of `https://github.com/mdrafiullah1830/nexusplay`

---

## 2. Wishlist Page Missing

**Status:** Feature is half-wired.

- `frontend/src/pages/product.ts` has a working `WishlistStore` + ♥ button (localStorage `nexusplay_wishlist`) ✅
- `renderWishlist()` targets markup that **no page has**: `.wishlist-list`, `.wishlist-count`, `.wishlist-summary`
- `.wishlist-toggle` click redirects to **`/wishlist.html` — this file does not exist** (only admin, cart, checkout, index, login, product, register, shop, track)

### To finish

- [ ] Create `frontend/wishlist.html` (`<body data-page="wishlist">` + `#wishlist-root`)
- [ ] Add a `wishlist` case + `initWishlistPage()` in `frontend/src/main.ts` switch
- [ ] Add `.wishlist-list` / `.wishlist-item` / `.wishlist-summary` styles in `_pages.scss`
- [ ] Show wishlist count in navbar (optional)

---

## 3. Minor / Nice-to-have

- [ ] Product page: "You May Also Like" rail has no loading skeleton (blank until API returns)
- [ ] `backend/NexusPlay.Api/Controllers/OrdersController.cs.bak` — stale backup file, should be deleted
- [ ] Hero slides use gradient placeholders — real product images not wired yet
- [ ] No 404 route for unknown `data-page` values in `main.ts`
