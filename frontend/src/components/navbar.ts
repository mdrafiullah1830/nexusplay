// ============================================================
// NEXUSPLAY — Apple-inspired Navbar + Mega Menu + Mobile drawer (auth-aware)
// ============================================================
import { auth } from "../services/auth";
import { cart } from "../services/cart";
import { getWishlistCount } from "../pages/product";

interface NavColumn {
  title: string;
  items: { label: string; href: string }[];
}

const COLUMNS: NavColumn[] = [
  {
    title: "Store",
    items: [
      { label: "Shop", href: "/shop.html" },
      { label: "Mac", href: "/#" },
      { label: "iPad", href: "/#" },
      { label: "Watch", href: "/#" },
      { label: "AirPods", href: "/#" },
    ],
  },
  {
    title: "Brands",
    items: [
      { label: "Apple", href: "/#" },
      { label: "Sony", href: "/#" },
      { label: "Bose", href: "/#" },
      { label: "Sennheiser", href: "/#" },
    ],
  },
  {
    title: "Features",
    items: [
      { label: "Support", href: "/#" },
      { label: "Warranty", href: "/#" },
      { label: "Returns", href: "/#" },
    ],
  },
];

function renderAccountArea(): string {
  const user = auth.user();
  if (auth.isLoggedIn() && user) {
    const firstName = user.name.split(" ")[0];
    return `<span class="navbar__user" title="${user.email}">👤 ${firstName}</span>
      <button class="navbar__icon-btn" id="logout-btn" title="Log out">⎋</button>`;
  }
  return '<a class="navbar__icon-btn" href="/login.html" title="Log in">👤</a>';
}

export function initNavbar(): void {
  const root = document.getElementById("navbar-root");
  if (!root) return;

  root.innerHTML = `
    <div class="announce">Free shipping on orders over $50 &nbsp;·&nbsp; <span>bKash & Credit Cards available</span></div>
    <header class="navbar">
      <div class="navbar__inner">
        <button class="navbar__icon-btn navbar__burger" id="burger" aria-label="Open menu">☰</button>

        <a href="/" class="navbar__logo">Nexus<span>Play</span></a>

        <nav class="navbar__links" aria-label="Main">
          <a class="navbar__link" href="/">Home</a>
          <a class="navbar__link" href="/shop.html">Shop</a>
          <a class="navbar__link" href="/#features">Features</a>
          <a class="navbar__link" href="/#about">About</a>
        </nav>

        <div class="navbar__actions" id="nav-actions">
          <a class="navbar__icon-btn" href="/shop.html" aria-label="Search">🔍</a>
          <a class="navbar__icon-btn navbar__wishlist" href="/wishlist.html" aria-label="Wishlist">
            ♥<span class="navbar__wishlist-count" id="wishlist-count">${getWishlistCount()}</span>
          </a>
          <span id="account-area">${renderAccountArea()}</span>
          <a class="navbar__icon-btn" href="/cart.html" aria-label="Cart">
            🛒<span class="navbar__cart-count" id="cart-count">${cart.count()}</span>
          </a>
        </div>
      </div>

      <div class="megamenu">
        <div class="megamenu__inner">
          ${COLUMNS.map(
            (col) => `
          <div>
            <div class="megamenu__col-title">${col.title}</div>
            ${col.items.map((i) => `<a class="megamenu__item" href="${i.href}">${i.label}</a>`).join("")}
          </div>`
      ).join("")}
          <div class="megamenu__promo">
            <strong>Premium Gear</strong>
            <span>Hand-picked selection, 30-day returns, white-glove support.</span>
          </div>
        </div>
      </div>

      <div class="mobile-menu" id="mobile-menu">
        <div class="mobile-menu__head">
          <span class="navbar__logo">Nexus<span>Play</span></span>
          <button class="mobile-menu__close" id="menu-close" aria-label="Close menu">✕</button>
        </div>
        <a class="mobile-menu__link" href="/">Home</a>
        <a class="mobile-menu__link" href="/shop.html">Shop</a>
        <a class="mobile-menu__link" href="/#features">Features</a>
        <a class="mobile-menu__link" href="/#about">About</a>
        <a class="mobile-menu__link" href="/cart.html">Cart</a>
        ${auth.isAdmin() ? `<a class="mobile-menu__link" href="/admin.html">Admin</a>` : ""}
      </div>
  `;

  // Mobile drawer
  const menu = document.getElementById("mobile-menu");
  document.getElementById("burger")?.addEventListener("click", () => menu?.classList.add("is-open"));
  document.getElementById("menu-close")?.addEventListener("click", () => menu?.classList.remove("is-open"));

  // Logout
  document.getElementById("logout-btn")?.addEventListener("click", () => auth.logout());

  // Keep cart badge fresh
  cart.onChange(() => {
    const badge = document.getElementById("cart-count");
    if (badge) badge.textContent = String(cart.count());
  });

  // Keep wishlist badge fresh (any ♥ add/remove anywhere on the site)
  document.addEventListener("wishlist:change", () => {
    const badge = document.getElementById("wishlist-count");
    if (badge) badge.textContent = String(getWishlistCount());
  });
}

/** Re-renders the account area (call after login/logout without reload). */
export function refreshAccountArea(): void {
  const area = document.getElementById("account-area");
  if (area) {
    area.innerHTML = renderAccountArea();
    document.getElementById("logout-btn")?.addEventListener("click", () => auth.logout());
  }
}
