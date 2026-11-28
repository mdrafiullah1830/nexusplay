# CtrlZoneBD — Master implementation target and AI handoff

Updated: 2026-11-28. Repository: mdrafiullah1830/nexusplay. Production: https://ctrlzonebd.com. This is the authoritative implementation roadmap; consult actual code and update status after each verified phase.

## Goal
Apple-inspired premium visual presentation across all storefront pages, Nike-inspired catalogue browsing, original CtrlZoneBD identity and real gaming hardware assets. Do not copy proprietary imagery, fonts or branding. Keep HTML/TypeScript/SCSS/Vite MPA and ASP.NET Core 8. Preserve existing products, users, orders, authentication, manual bKash and COD, Cloudflare frontend/Worker and Render API. Runtime database provider is configured D1 or MongoDB; verify rather than assume.

## Execution protocol for any AI/developer
1. Read this file, README, current branch heads, pending PRs, and relevant source. Do not overwrite others' changes. Resume first incomplete task.
2. Work in isolated feature branches; commit and push coherent tested batches. Continue to next phase without waiting for routine approval, but stop for unsafe/destructive actions, missing credentials or unresolved tests. Never expose secrets or use live customer records for testing.
3. Run frontend npm ci, npm run build, add and run automated tests; run .NET 8 build/test with correct solution/project and test configuration. Use mocked/sandbox payments and isolated databases. Verify responsive desktop/mobile Safari/WebKit and Chromium, keyboard navigation, errors, loading and empty states. Record commands, results and commit SHA in this file. Mark implemented separately from verified; never invent test passes.
4. Open PRs and inspect diff, CI and preview. Do not merge into production until verification and explicit production approval; main triggers Cloudflare/Render deployments. No destructive migrations, resets or production payment tests. Preserve rollback path and existing storage keys.
5. If a tool lacks execution or write access, document blocker and exact next step. Continue independent safe tasks where possible. No unattended/background execution is implied by this document.

## Phase 0A — Audit [source review done; runtime pending]
Baseline main 6bb6592b1e3ac583f7402ab5432044af617bf9c5. Key findings: layered SCSS overrides, animation initialization blocks page init, static homepage content, hardcoded filter ranges, checkout endpoint mismatch, missing orders build/router, user order pagination after global filtering, local wishlist, relative SSE URL, unverified gateways. Full line-by-line audit, live browser, build and security scans remain pending.

## Phase 0B — Commerce reliability [in progress]
- [x] Create fix/phase-0b-commerce branch.
- [x] Checkout source fix cde45451cfcd2848a8fb3d0f324487965589017c: route COD/manual bKash to /orders, use server response, disable unsupported gateway UI, prevent repeat submit, escape checkout HTML. Build/E2E pending.
- [ ] My Orders: add orders.html to vite.config.ts, orders route to main.ts, new pages/orders.ts; paginate and filter by authenticated user in both D1 and Mongo repositories; fix claim mapping in OrdersController; test isolation and empty/error states.
- [ ] Wishlist: pages/product.ts + new shared service; authenticated API sync, guest merge, direct ID loading, account isolation; preserve guest data.
- [ ] Tracking: pages/track.ts, services/api.ts, OrdersController, repository phone validation; require full phone or authorized owner, protect SSE or use authenticated polling, no public order data leakage.
- [ ] Payment: review PaymentsController/PaymentService and admin status transitions; provider-specific feature flags, amount/currency/order binding, idempotency, no unsupported Stripe or unverified SSLCOMMERZ options. Keep manual bKash and COD.
- [ ] Cart: validate qty, variants, stock and current server price; retain cart on failures, idempotent order submission, clear only after accepted order.
- [ ] Security: audit HTML injection, authorization, token handling, CORS, rate limits, default credentials and dependency risks. Never commit secrets.
- [ ] Gate: successful build and tests, authenticated order isolation, COD/manual bKash mock checkout, failure and duplicate handling, wishlist and tracking verification.

## Phase 1 — Design foundation [pending]
Files frontend/src/styles/{_tokens,_base,_theme-modes,_blue-theme,_ctrlzone,_gradients,main}.scss, services/theme.ts, main.ts, animation modules. Single CSS custom-property token system, native system/Inter typography, sentence case, neutral #fff/#f5f5f7/#1d1d1f, restrained #0071e3 accent, responsive spacing, accessible focus, light default with saved preference respected, reduced motion. Consolidate legacy overrides only after verifying all pages. Nonblocking page initialization. Gate: all existing pages build, no overflow at 320–1440px, contrast and keyboard checks.

## Phase 2 — Homepage and global chrome [pending]
index.html, pages/home.ts, components/{navbar,footer,heroSlider,hero3d,heroArena,searchOverlay}.ts, styles/{_navbar,_header-extras,_hero,_signal,_experience,_sections}.scss. Compact sticky navigation, accessible mega menu/mobile drawer, large actual GameSir/Flydigi/8BitDo product hero and feature tiles, collection and category rails, clear CTA, support/footer, responsive images and limited motion. Remove redundant marquees and heavy decoration. Use original product photography with rights; no fake specs, stock or claims. Initially reuse existing catalogue; later CMS. Gate: responsive screenshots, functional links/search/cart, no layout shift or broken images.

## Phase 3 — Catalogue and product details [pending]
shop.html, product.html, pages/{shop,product}.ts, components/productCard.ts, types.ts, data/products.ts, styles/_product.scss; backend Product.cs, Queries.cs, ProductsController, repository implementations. Nike-inspired product grid, desktop sidebar/mobile filter drawer, active chips, product counts, sorting, URL state, dynamic facets for brand/category/stock/price/compatibility/connectivity, pagination, safe fallback, gallery/zoom, features/specs, color/variant options, related products, optional comparison. Preserve existing IDs and links. Gate: filters/search/sort consistent across providers, keyboard navigation and mobile usability.

## Phase 4 — Commerce and account UX [pending]
cart.html, checkout.html, login.html, register.html, orders.html, wishlist.html, track.html; pages/{cart,checkout,auth,orders,track,product}.ts, services/{cart,auth,api,i18n}.ts, components/miniCart.ts, styles/_pages.scss (split by page). Clean bag and checkout, accessible forms, clear delivery/price/stock, order history and tracking, account-aware wishlist, localization. Do not regress Phase 0B. Gate: full mock guest/account shopping journeys and errors.

## Phase 5 — Backend and admin expansion [pending]
admin.html, pages/admin.ts, AdminController, Product/Queries/IRepositories, D1Client/D1Repositories, Mongo repositories, Program.cs, worker.js. Add optional HomepageSections, Collections, Categories, ProductMedia, ProductVariants, ProductAttributes, SiteSettings, structured reviews and promotions as justified. Public homepage/category/brand/facets/collection/settings APIs and admin CRUD with role authorization, validation, preview/publish, media alt text, ordering, visibility. Use additive versioned migrations with provider parity and preserve existing rows. No destructive schema changes. Gate: migration dry run and rollback strategy, CRUD authorization, content preview, existing product integrity.

## Phase 6 — QA and deployment [pending]
package.json, automated frontend/backend tests, CI, README, ANIMATION_STRATEGY.md, incomplete.md. Test browser matrix, accessibility WCAG 2.2 AA target, security, SEO metadata, sitemap, responsive images, cache, Core Web Vitals targets LCP <=2.5s, INP <=200ms, CLS <=0.1 at p75 (measure rather than claim). Verify Cloudflare preview and Render test environment. Commit results and PR. Production merge/deploy only after gates and explicit approval; smoke test and rollback if needed.

## Status log
- 2026-11-28: Phase 0A architecture/source review; no runtime verification.
- 2026-11-28: Phase 0B checkout fix committed on isolated branch, tests pending.
- Next: complete My Orders and tracking privacy fixes, add tests, then continue remaining tasks in sequence.
