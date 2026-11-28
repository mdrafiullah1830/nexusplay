# 🎮 NexusPlay

A modern gaming e-commerce store for Bangladesh — controllers, keyboards, mice and
accessories at honest prices. Built with a Nike-inspired design system.

**Frontend:** HTML5 · SCSS · TypeScript · Vite (MPA)
**Backend:** ASP.NET Core 8 Web API · JWT auth
**Database:** MongoDB

---

## ✨ Features

- **Catalogue** — 22 seeded products with category / brand / availability / price
  filters, search, sorting and pagination
- **Product detail** — gallery, colour & quantity pickers, specs table, related items
- **Cart** — localStorage-backed cart with live badge, qty steppers, free-delivery
  progress (free delivery over BDT 5,000, otherwise BDT 120)
- **Checkout** — Cash on Delivery **and** bKash (manual TrxID submission)
- **Order tracking** — track by order number + phone, visual timeline
- **Auth** — register / login with JWT (BCrypt-hashed passwords) and Google Sign-In
- **Admin panel** — dashboard stats, product CRUD, order status management,
  one-click bKash payment verification
- **Theme** — light by default; homepage/shop preference is saved locally
- **Responsive** — mega-menu on desktop, slide-in drawer on mobile

## 📁 Project structure

```
nexusplay/
├── frontend/          # Vite + TypeScript + SCSS multi-page app
│   ├── *.html         # index, shop, product, cart, checkout, track,
│   │                  # login, register, admin
│   └── src/
│       ├── components/  # navbar (mega menu + drawer), footer, cards, hero
│       ├── pages/       # one module per page
│       ├── services/    # api client, cart, auth, toast
│       ├── styles/      # SCSS design system (tokens → base → components)
│       └── data/        # static fallback catalogue
└── backend/           # .NET solution
    ├── NexusPlay.Core   # models + repository interfaces
    ├── NexusPlay.Data   # MongoDB context, repositories, product seeder
    └── NexusPlay.Api    # controllers, JWT, seeding, Swagger
```

## 🚀 Running locally

### Prerequisites

- MongoDB running on `mongodb://localhost:27017`
- .NET 8 SDK
- Node.js 18+

### 1. Start MongoDB

```bash
mongod --config /opt/homebrew/etc/mongod.conf     # macOS (Homebrew)
# or: brew services start mongodb-community  (Linuxbrew / services-enabled setups)
```

### 2. Backend (port 5000)

```bash
cd backend
dotnet run --project NexusPlay.Api
```

On first run it automatically:
- creates indexes,
- seeds **22 products**,
- creates the admin account.

API base: `http://localhost:5000/api` (Swagger UI at `/swagger` in dev).

### 3. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — `/api` requests are proxied to the backend.

### Production build

```bash
cd frontend && npm run build     # output in frontend/dist
```

### Automated backend tests

```bash
cd backend
dotnet test NexusPlay.slnx
```

### Production updates

Push to `main` to trigger the Cloudflare `ctrlzonebd` frontend build and the
Render `ctrlzonebd-api` backend deploy. The Cloudflare `ctrlzonebd-data` Worker
is also connected to `main`; its build root is `cloudflare/d1-gateway` and it
deploys with `npx wrangler deploy`.

The backend applies numbered D1 schema migrations on startup. Add new,
retry-safe SQL statements to `D1Client.InitializeAsync` with a new version
number when changing the database schema. Existing product records are not
overwritten by deploys: `ProductSeeder` only runs when the catalogue is empty.
Update products through the admin API instead.

### Proxy client IPs and rate limits

Rate limits use the socket peer IP by default. To accept one `X-Forwarded-For`
hop on Render, set `Proxy__KnownProxies` to the exact IP address of the proxy
that connects to Kestrel (comma-separated if there are multiple verified peers).
Only configure addresses observed in a test environment. The middleware ignores
forwarded headers from other peers. Verify the resulting rate-limit partitions
with requests from separate clients before release; a second Cloudflare hop may
mean the forwarded address is still a proxy. Do not enable unrestricted
`ASPNETCORE_FORWARDEDHEADERS_ENABLED` or `DOTNET_FORWARDEDHEADERS_ENABLED`.

## 🔐 Credentials

| Role  | Email               | Password   |
|-------|---------------------|------------|
| Admin | `admin@nexusplay.com` | `Admin@123` |

Admin panel: `http://localhost:5173/admin.html`

### Google Sign-In setup

Google Sign-In is disabled until a Web application OAuth client ID is configured:

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth client ID** with application type **Web application**.
3. Add `http://localhost:5173` to **Authorized JavaScript origins**.
4. Add `http://localhost:5173/login.html` and `http://localhost:5173/register.html` to
   **Authorized redirect URIs** (these are safe redirect URIs for the GIS button).
5. Copy the client ID into `backend/NexusPlay.Api/appsettings.json`:

   ```json
   "Google": {
     "ClientId": "1234567890-example.apps.googleusercontent.com"
   }
   ```

For deployed environments, set it through an environment variable instead of
committing it to `appsettings.json`:

```bash
export Google__ClientId="1234567890-example.apps.googleusercontent.com"
```

Then add the deployed frontend origin and redirect URIs in Google Cloud Console.
A client secret is **not required** for this GIS ID-token flow.

> Change `Admin:*` and `Jwt:Secret` in
> `backend/NexusPlay.Api/appsettings.json` before deploying.

## 🧪 Order flow

| Step | What happens |
|------|--------------|
| 1 | Customer adds items → checkout → fills address |
| 2a | **COD** → order created as `pending` |
| 2b | **bKash** → customer sends money to `01782577251`, pastes TrxID → order created as `awaiting-verification` |
| 3 | Admin verifies TrxID in the admin panel → `confirmed` |
| 4 | `shipped` → `delivered` (status changes are recorded in the tracking timeline) |

Prices and delivery fees are **always re-calculated server-side** when an order is
placed — client-sent amounts are never trusted.

Order numbers look like `NP2611175722` (`NP` + date + random). Customers track
orders with the order number + the phone they ordered with.

## 🛠 Useful API endpoints

```
GET    /api/products?category=&brand=&stock=&min=&max=&q=&sort=&page=
GET    /api/products/{id}
POST   /api/auth/register          { name, email, phone?, password }
POST   /api/auth/login             { email, password }
GET    /api/auth/google/config
POST   /api/auth/google            { credential, csrfToken, password? }
GET    /api/auth/me                (Bearer)
POST   /api/orders                 { customer, items, paymentMethod, bkashTrxId? }
GET    /api/orders/track?orderNo=&phone=
GET    /api/orders/my              (Bearer)
GET    /api/admin/stats            (Bearer · admin)
GET    /api/admin/products         (Bearer · admin)
POST   /api/admin/products         (Bearer · admin)
PUT    /api/admin/products/{id}    (Bearer · admin)
DELETE /api/admin/products/{id}    (Bearer · admin)
GET    /api/admin/orders?status=&q= (Bearer · admin)
PUT    /api/admin/orders/{id}/status  { status, note? }  (Bearer · admin)
```

## 📝 Notes

- Product images are currently emoji + brand-gradient placeholders; drop real
  images into the `image` field of any product to use them.
- The bKash flow is intentionally **manual** (TrxID verification by admin) — no
  payment gateway integration.
- JWT expiry defaults to 7 days (`Jwt:ExpiryMinutes`).
## 🎨 UI Design Guidelines (Apple + Nike)

Apple‑style UI  
- Minimalist layout with generous whitespace.  
- Hero sections featuring full‑width product images.  
- Card‑based product tiles with subtle shadows.  
- Clean system/Inter sans-serif typography and a neutral palette (#fff, #f5f5f7, #1d1d1f) with a restrained #0071e3 accent.
- Simple navigation, sticky top bar, and lazy‑loaded images (srcset, IntersectionObserver).

Nike‑style UI  
- Restrained electric-blue accent for key actions; reserve product colours for imagery.
- Dynamic hero carousels or video loops that convey motion and energy.  
- Badge‑styled category tiles and interactive filter/sort widgets.  
- Use an original system/Inter sans-serif stack with strong weight contrast for headings.
- Rich JavaScript animations (CSS transitions, GSAP) for hover effects and product showcases.

Combining the two for ctrlzonebd.com  
1. Base layout – adopt Apple’s clean grid and whitespace. Use a simple card component for product listings.  
2. Hero section – replace static hero image with a short looping video or animated slider (Nike style) while keeping the minimal background.  
3. Accent colours – use #0071e3 for primary actions and derive secondary colours from product imagery only where needed.
4. Typography – use the system/Inter sans-serif stack, with weight and size contrast for headings.
5. Interactive components – implement subtle hover animations (fade‑in, scale) on cards (Apple) and more pronounced transition effects on promotional banners (Nike).  
6. Responsiveness – ensure the grid collapses gracefully on mobile; keep hero images responsive with srcset.  

By merging Apple’s restrained, premium feel with Nike’s vibrant, motion‑driven elements, ctrlzonebd.com can deliver a modern, engaging storefront that feels both trustworthy and energetic.
