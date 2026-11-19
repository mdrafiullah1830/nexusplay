# Incomplete Tasks — NexusPlay

> Status list of work that is planned but **not yet done**.
> Last updated: 2026-11-19 (after 3D animation + wishlist work)

---

## 1. Raw 3D Animation Layer — ✅ DONE

**Goal:** Site-wide "3D animation look" using **hand-coded raw CSS 3D transforms + vanilla JS only — no animation libraries** (no GSAP, no Framer Motion, etc.).

**Shipped** (commit `bfb5d1d`):

| File | Status | Purpose |
|---|---|---|
| `frontend/src/styles/_3d.scss` | ✅ created | All raw CSS 3D styles (loaded last) |
| `frontend/src/components/animations.ts` | ✅ created | IntersectionObserver reveal + hero mouse parallax |
| `frontend/src/styles/main.scss` | ✅ edited | `@use "3d" as *;` (last) |
| `frontend/src/main.ts` | ✅ edited | `initAnimations()` in `DOMContentLoaded` |
| `frontend/src/components/heroSlider.ts` | ✅ edited | Direction-aware slides (`data-dir`, `is-leaving`, `is-snap`) |
| `frontend/src/styles/_product.scss` | ✅ edited | `cardRise` fill `forwards` → `backwards` (reveal compatibility) |
| `frontend/src/components/productCard.ts` | ✅ edited | Tilt ±8° + shadow follow, document-delegated (works for dynamic cards) |

**Remaining:**
- [ ] Visual check in Safari at `http://localhost:5173` (all pages: home, shop, product, cart, checkout, track, login, wishlist)
  - ⚠️ note: old note said port `5175`, actual vite port is **5173** (`vite.config.ts`)

---

## 2. Wishlist Page — ✅ DONE

**Was:** feature half-wired (`WishlistStore` + ♥ button existed, but no page/markup/entry point).

**Shipped:**
- [x] `frontend/wishlist.html` created (`data-page="wishlist"` + `#wishlist-root`, `.wishlist-list` / `.wishlist-count` / `.wishlist-summary`)
- [x] `wishlist` case + `initWishlistPage()` in `frontend/src/main.ts` switch
- [x] `.wishlist-remove` delegated handler in `pages/product.ts` (Remove button previously had no handler)
- [x] ♥ button 2s-revert bug fixed (no longer flips back to "Wishlist" while item is still saved)
- [x] Navbar ♥ icon + live count badge (`navbar__wishlist-count`, updates on `wishlist:change`)
- [x] Styles: `_pages.scss` (wishlist page) + `_navbar.scss` (badge, shared `%nav-badge` placeholder)
- [x] `vite.config.ts` — `wishlist` added to build inputs

---

## 3. Minor / Nice-to-have

- [x] Product page: "You May Also Like" rail loading skeleton (`.p-skeleton` shimmer, 3 placeholder cards)
- [x] `backend/NexusPlay.Api/Controllers/OrdersController.cs.bak` — deleted
- [ ] Hero slides use gradient placeholders — real product images not wired yet
  - **Blocked:** `data/products.ts` has no `imageUrls` (products render emoji). Needs real image assets/URLs first.
- [x] 404 route for unknown `data-page` values in `main.ts` (`default:` case → `.page-message`)

---

## Suggested next steps

1. Hero real images: add image URLs to product data (or `/public/img/…`), then swap `.hero__slide--N` gradients for `<img>` layers
2. API-backed wishlist (`renderWishlist()` currently filters `localProducts` only)
3. Loading skeletons for shop grid / rails (same `.p-skeleton` pattern)
