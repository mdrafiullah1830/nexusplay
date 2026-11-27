// ============================================================
// NEXUSPLAY — Header: nav, mega menu, search, account, cart
// Apple/Nike-inspired: quiet chrome, clear hierarchy, one accent.
// ============================================================
import { auth } from "../services/auth";
import { cart } from "../services/cart";
import { getWishlistCount } from "../pages/product";
import { getLang, setLang, t } from "../services/i18n";
import { initSearch, type SearchApi } from "./searchOverlay";
import { initMiniCart, openMiniCart } from "./miniCart";
import { getTheme, toggleTheme } from "../services/theme";

const SUPPORT_TEL = "+8801782577251";
const SUPPORT_TEL_LABEL = "+880 1782-577251";
const SUPPORT_WA = "https://wa.me/8801782577251";
const SUPPORT_MAIL = "gamersgrip73@gmail.com";

let cleanup: AbortController | null = null;
let search: SearchApi | null = null;
let announceTimer: number | undefined;
let globalBound = false;
let drawerOpen = false;

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch];
  });
}

// -- Account ---------------------------------------------------
function renderAccountArea(): string {
  const user = auth.user();

  if (auth.isLoggedIn() && user) {
    const firstName = esc(user.name.split(" ")[0] || user.name);
    return `
      <button class="navbar__icon-btn account__trigger" id="account-btn" type="button"
              aria-label="${t("nav.account")}" aria-expanded="false" aria-controls="account-menu">
        👤<span class="account__name">${firstName}</span>
      </button>
      <div class="account__menu" id="account-menu">
        <div class="account__meta">
          <small>${t("account.signedInAs")}</small>
          <strong>${esc(user.name)}</strong>
          <span>${esc(user.email)}</span>
        </div>
        <a class="account__item" href="/wishlist.html">♥ <span>${t("account.wishlist")}</span></a>
        <a class="account__item" href="/track.html">📦 <span>${t("account.track")}</span></a>
        ${auth.isAdmin() ? `<a class="account__item" href="/admin.html">⚙ <span>${t("account.admin")}</span></a>` : ""}
        <button class="account__item account__item--danger" id="logout-btn" type="button">
          ⎋ <span>${t("account.logout")}</span>
        </button>
      </div>`;
  }

  return `
    <button class="navbar__icon-btn account__trigger" id="account-btn" type="button"
            aria-label="${t("nav.account")}" aria-expanded="false" aria-controls="account-menu">
      👤
    </button>
    <div class="account__menu" id="account-menu">
      <a class="account__item" href="/login.html">👤 <span>${t("account.signin")}</span></a>
      <a class="account__item" href="/register.html">+ <span>${t("account.signup")}</span></a>
      <div class="account__sep"></div>
      <a class="account__item" href="/wishlist.html">♥ <span>${t("account.wishlist")}</span></a>
      <a class="account__item" href="/track.html">📦 <span>${t("account.track")}</span></a>
    </div>`;
}

function megaItem(label: string, href: string, badge?: "new" | "sale"): string {
  const pill = badge
    ? `<span class="nav-pill nav-pill--${badge}">${badge === "sale" ? t("nav.sale") : t("mega.badge.new")}</span>`
    : "";
  return `<a class="megamenu__item" href="${href}"><span>${label}</span>${pill}</a>`;
}

// -- Announcement bar -----------------------------------------
function announceMarkup(): string {
  const items = [
    t("announce.shipping"),
    t("announce.payment"),
    t("announce.trust"),
    `<a href="/shop.html?stock=pre-order">${t("announce.preorder")}</a>`,
    `<a href="tel:${SUPPORT_TEL}">${t("announce.hotline")}</a>`,
  ];

  return `
    <div class="announce" aria-label="Store announcements">
      <div class="announce__rotator" id="announce-rotator">
        ${items
          .map(
            (html, i) =>
              `<span class="announce__item${i === 0 ? " is-active" : ""}">${html}</span>`,
          )
          .join("")}
      </div>
    </div>`;
}

// -- Mobile drawer --------------------------------------------
function mobileMenuMarkup(): string {
  const signedIn = auth.isLoggedIn();

  return `
    <div class="mobile-menu" id="mobile-menu" role="dialog" aria-modal="true"
         aria-label="${t("nav.menu")}" aria-hidden="true">
      <div class="mobile-menu__head">
        <span class="navbar__logo"><img src="/ctrlzonebd-icon.svg" alt="" />CTRL<span>ZONEBD</span></span>
        <button class="mobile-menu__close" id="menu-close" type="button" aria-label="${t("nav.close")}">✕</button>
      </div>

      <a class="mobile-menu__link" href="/">${t("nav.home")}</a>
      <a class="mobile-menu__link" href="/shop.html">${t("nav.shop")}</a>
      <a class="mobile-menu__link" href="/track.html">${t("nav.track")}</a>
      <a class="mobile-menu__link" href="/#support">${t("nav.support")}</a>

      <div class="mobile-menu__section">
        <div class="mobile-menu__title">${t("drawer.shop")}</div>
        <a class="mobile-menu__sub" href="/shop.html?category=controllers">${t("mega.controllers")}</a>
        <a class="mobile-menu__sub" href="/shop.html?q=cooling">${t("mega.cooling")}</a>
        <a class="mobile-menu__sub" href="/shop.html?q=dock">${t("mega.docks")}</a>
        <a class="mobile-menu__sub" href="/shop.html?stock=pre-order">${t("mega.preorders")}</a>
      </div>

      <div class="mobile-menu__section">
        <div class="mobile-menu__title">${t("drawer.account")}</div>
        <a class="mobile-menu__sub" href="/wishlist.html">${t("nav.wishlist")}</a>
        <a class="mobile-menu__sub" href="/cart.html">${t("nav.cart")}</a>
        ${
          signedIn
            ? `<a class="mobile-menu__sub" href="/track.html">${t("account.track")}</a>`
            : `<a class="mobile-menu__sub" href="/login.html">${t("account.signin")}</a>`
        }
        ${auth.isAdmin() ? `<a class="mobile-menu__sub" href="/admin.html">${t("account.admin")}</a>` : ""}
      </div>

      <div class="mobile-menu__section">
        <div class="mobile-menu__title">${t("drawer.support")}</div>
        <a class="mobile-menu__sub" href="${SUPPORT_WA}" target="_blank" rel="noopener">${t("drawer.whatsapp")}</a>
        <a class="mobile-menu__sub" href="tel:${SUPPORT_TEL}">${t("drawer.call")} · ${SUPPORT_TEL_LABEL}</a>
        <a class="mobile-menu__sub" href="mailto:${SUPPORT_MAIL}">${SUPPORT_MAIL}</a>
      </div>

      <button class="mobile-menu__lang" type="button" data-lang-toggle>
        ${getLang() === "en" ? "বাংলা" : "English"}
      </button>
    </div>`;
}

// -- Header markup --------------------------------------------
function renderHeader(root: HTMLElement): void {
  const themeToggleMarkup = ["home", "shop"].includes(document.body.dataset.page ?? "")
    ? `<button class="navbar__icon-btn navbar__theme-btn" id="theme-btn" type="button"
        aria-label="Switch to ${getTheme() === "dark" ? "light" : "dark"} mode"
        title="Switch to ${getTheme() === "dark" ? "light" : "dark"} mode"
        aria-pressed="${getTheme() === "light"}">
        <span class="navbar__theme-icon" aria-hidden="true">${getTheme() === "dark" ? "☼" : "☾"}</span>
        <span class="navbar__theme-label">${getTheme() === "dark" ? "LIGHT" : "DARK"}</span>
      </button>`
    : "";

  root.innerHTML = `
    <a class="skip-link" href="#main-content">${t("skip")}</a>${announceMarkup()}

    <header class="navbar">
      <div class="navbar__inner">
        <button class="navbar__icon-btn navbar__burger" id="burger" type="button"
                aria-label="${t("nav.menu")}" aria-expanded="false" aria-controls="mobile-menu">☰</button>

        <a href="/" class="navbar__logo" aria-label="CtrlZoneBD home"><img src="/ctrlzonebd-icon.svg" alt="" />CTRL<span>ZONEBD</span></a>

        <nav class="navbar__links" aria-label="Main">
          <a class="navbar__link" href="/">${t("nav.home")}</a>
          <a class="navbar__link navbar__link--mega" id="mega-trigger" href="/shop.html"
             aria-haspopup="true" aria-expanded="false" aria-controls="megamenu">
            ${t("nav.shop")}<span class="nav-pill nav-pill--sale">${t("nav.sale")}</span>
          </a>
          <a class="navbar__link" href="/track.html">${t("nav.track")}</a>
          <a class="navbar__link" href="/#support">${t("nav.support")}</a>
        </nav>

        <div class="navbar__actions">
          <button class="navbar__icon-btn" id="search-btn" type="button"
                  aria-label="${t("nav.search")}" aria-expanded="false" aria-controls="search-panel">🔍</button>

          <a class="navbar__icon-btn navbar__wishlist" href="/wishlist.html" aria-label="${t("nav.wishlist")}">
            ♥<span class="navbar__wishlist-count" id="wishlist-count">${getWishlistCount()}</span>
          </a>

          ${themeToggleMarkup}

          <button class="navbar__icon-btn navbar__lang" id="lang-btn" type="button"
                  aria-label="${t("nav.language")}" title="${t("nav.language")}">
            ${getLang() === "en" ? "বাংলা" : "EN"}
          </button>

          <div class="account" id="account-area">${renderAccountArea()}</div>

          <button class="navbar__icon-btn" id="cart-btn" type="button"
                  aria-label="${t("nav.cart")}" aria-haspopup="dialog">
            🛒<span class="navbar__cart-count" id="cart-count">${cart.count()}</span>
          </button>
        </div>
      </div>

      <div class="megamenu" id="megamenu">
        <div class="megamenu__inner">
          <div class="megamenu__col">
            <div class="megamenu__col-title">${t("mega.shop")}</div>
            ${megaItem(t("mega.controllers"), "/shop.html?category=controllers")}
            ${megaItem(t("mega.cooling"), "/shop.html?q=cooling")}
            ${megaItem(t("mega.docks"), "/shop.html?q=dock")}
            ${megaItem(t("mega.preorders"), "/shop.html?stock=pre-order", "new")}
          </div>

          <div class="megamenu__col">
            <div class="megamenu__col-title">${t("mega.brands")}</div>
            ${megaItem("GameSir", "/shop.html?brand=GameSir")}
            ${megaItem("Flydigi", "/shop.html?brand=Flydigi")}
            ${megaItem("8BitDo", "/shop.html?brand=8BitDo")}
            ${megaItem("EasySMX", "/shop.html?brand=EasySMX")}
          </div>

          <div class="megamenu__col">
            <div class="megamenu__col-title">${t("mega.deals")}</div>
            ${megaItem(t("mega.under3k"), "/shop.html?max=3000")}
            ${megaItem(t("mega.under5k"), "/shop.html?max=5000")}
            ${megaItem(t("mega.savings"), "/shop.html?sort=discount", "sale")}
            ${megaItem(t("mega.all"), "/shop.html")}
          </div>

          <div class="megamenu__promo">
            <span class="nav-pill nav-pill--new">${t("mega.badge.new")}</span>
            <strong>${t("mega.promo.title")}</strong>
            <p class="megamenu__promo-text">${t("mega.promo.text")}</p>
            <a class="megamenu__promo-cta" href="/shop.html?brand=Flydigi">${t("mega.promo.cta")} →</a>
          </div>
        </div>
      </div>

      <div class="search-panel" id="search-panel">
        <div class="search-panel__inner">
          <div class="search-panel__field">
            <span class="search-panel__icon" aria-hidden="true">🔍</span>
            <input id="search-input" type="search" placeholder="${t("search.placeholder")}"
                   aria-label="${t("search.label")}" role="combobox" aria-expanded="false"
                   aria-controls="search-results" aria-autocomplete="list" autocomplete="off" />
            <button class="search-panel__close" id="search-close" type="button"
                    aria-label="${t("search.clear")}">✕</button>
          </div>
          <div class="search-results-host" id="search-results" aria-label="${t("search.label")}"></div>
        </div>
      </div>
    </header>

    ${mobileMenuMarkup()}`;
}

// -- Mega menu ------------------------------------------------
function setMega(open: boolean): void {
  document.getElementById("megamenu")?.classList.toggle("is-open", open);
  document.getElementById("mega-trigger")?.setAttribute("aria-expanded", String(open));
  if (open) {
    if (search?.isOpen()) search.close();
    toggleAccount(false);
  }
}

// -- Account dropdown -----------------------------------------
function toggleAccount(force?: boolean): void {
  const area = document.getElementById("account-area");
  if (!area) return;
  const next = force ?? !area.classList.contains("is-open");
  area.classList.toggle("is-open", next);
  document.getElementById("account-btn")?.setAttribute("aria-expanded", String(next));
  if (next) setMega(false);
}

// -- Mobile drawer --------------------------------------------
function openDrawer(): void {
  const menu = document.getElementById("mobile-menu");
  if (!menu) return;
  setMega(false);
  toggleAccount(false);
  if (search?.isOpen()) search.close();
  drawerOpen = true;
  menu.classList.add("is-open");
  menu.setAttribute("aria-hidden", "false");
  document.getElementById("burger")?.setAttribute("aria-expanded", "true");
  document.body.classList.add("drawer-open");
  document.getElementById("menu-close")?.focus();
}

function closeDrawer(): void {
  const menu = document.getElementById("mobile-menu");
  if (!menu) return;
  drawerOpen = false;
  menu.classList.remove("is-open");
  menu.setAttribute("aria-hidden", "true");
  document.getElementById("burger")?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("drawer-open");
  document.getElementById("burger")?.focus();
}

// -- Bindings -------------------------------------------------
function bindMega(signal: AbortSignal): void {
  const trigger = document.getElementById("mega-trigger");
  const navbar = document.querySelector<HTMLElement>(".navbar");
  if (!trigger || !navbar) return;

  trigger.addEventListener("mouseenter", () => setMega(true), { signal });
  trigger.addEventListener("focus", () => setMega(true), { signal });
  trigger.addEventListener("click", () => setMega(false), { signal });

  document
    .querySelectorAll<HTMLElement>(".navbar__link:not(#mega-trigger)")
    .forEach((link) => link.addEventListener("mouseenter", () => setMega(false), { signal }));

  navbar.addEventListener("mouseleave", () => setMega(false), { signal });
  navbar.addEventListener(
    "focusout",
    (event) => {
      const next = (event as FocusEvent).relatedTarget as Node | null;
      if (!next || !navbar.contains(next)) setMega(false);
    },
    { signal },
  );
}

function bindDrawer(signal: AbortSignal): void {
  const menu = document.getElementById("mobile-menu");
  if (!menu) return;

  menu.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ).filter((el) => el.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal },
  );
}

function bindClicks(root: HTMLElement, signal: AbortSignal): void {
  root.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;

      if (target.closest("#theme-btn")) {
        const next = toggleTheme();
        const button = root.querySelector<HTMLButtonElement>("#theme-btn");
        if (button) {
          const targetMode = next === "dark" ? "light" : "dark";
          const label = "Switch to " + targetMode + " mode";
          button.setAttribute("aria-label", label);
          button.setAttribute("title", label);
          button.setAttribute("aria-pressed", String(next === "light"));
          const icon = button.querySelector<HTMLElement>(".navbar__theme-icon");
          const text = button.querySelector<HTMLElement>(".navbar__theme-label");
          if (icon) icon.textContent = next === "dark" ? "☼" : "☾";
          if (text) text.textContent = next === "dark" ? "LIGHT" : "DARK";
        }
        return;
      }

      if (target.closest("#lang-btn") || target.closest("[data-lang-toggle]")) {
        setLang(getLang() === "en" ? "bn" : "en");
        mount();
        return;
      }

      if (target.closest("#burger")) {
        openDrawer();
        return;
      }

      if (target.closest("#menu-close")) {
        closeDrawer();
        return;
      }

      if (target.closest("#logout-btn")) {
        auth.logout();
        return;
      }

      if (target.closest("#account-btn")) {
        event.preventDefault();
        toggleAccount();
        return;
      }

      if (target.closest("#cart-btn")) {
        setMega(false);
        toggleAccount(false);
        if (search?.isOpen()) search.close();
        openMiniCart();
        return;
      }

      if (target.closest("#search-btn")) {
        setMega(false);
        toggleAccount(false);
      }
    },
    { signal },
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as Node;

      const account = document.getElementById("account-area");
      if (account?.classList.contains("is-open") && !account.contains(target)) {
        toggleAccount(false);
      }

      const menu = document.getElementById("megamenu");
      const trigger = document.getElementById("mega-trigger");
      if (
        menu?.classList.contains("is-open") &&
        !menu.contains(target) &&
        !trigger?.contains(target)
      ) {
        setMega(false);
      }
    },
    { signal },
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      toggleAccount(false);
      setMega(false);
      if (drawerOpen) closeDrawer();
      if (search?.isOpen()) search.close();
    },
    { signal },
  );
}

function startAnnounce(root: HTMLElement, signal: AbortSignal): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>(".announce__item"));
  if (items.length < 2) return;

  const rotator = document.getElementById("announce-rotator");
  let index = 0;
  let paused = false;

  rotator?.addEventListener("mouseenter", () => (paused = true), { signal });
  rotator?.addEventListener("mouseleave", () => (paused = false), { signal });
  rotator?.addEventListener("focusin", () => (paused = true), { signal });
  rotator?.addEventListener("focusout", () => (paused = false), { signal });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  announceTimer = window.setInterval(() => {
    if (paused || document.hidden) return;
    items[index].classList.remove("is-active");
    index = (index + 1) % items.length;
    items[index].classList.add("is-active");
  }, 5200);
}

function bindScroll(signal: AbortSignal): void {
  const navbar = document.querySelector<HTMLElement>(".navbar");
  if (!navbar) return;

  let lastY = window.scrollY;
  let ticking = false;

  const update = (): void => {
    const y = window.scrollY;
    navbar.classList.toggle("is-scrolled", y > 12);

    const menuOpen = !!navbar.querySelector(
      ".megamenu.is-open, .account.is-open, .search-panel.is-open",
    );

    if (!menuOpen && Math.abs(y - lastY) > 8) {
      navbar.classList.toggle("is-hidden", y > 280 && y > lastY);
    }

    if (y <= 280) navbar.classList.remove("is-hidden");

    lastY = y;
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    },
    { passive: true, signal },
  );
}

function bindGlobal(): void {
  if (globalBound) return;
  globalBound = true;

  cart.onChange(() => {
    const badge = document.getElementById("cart-count");
    if (badge) badge.textContent = String(cart.count());
  });

  document.addEventListener("wishlist:change", () => {
    const badge = document.getElementById("wishlist-count");
    if (badge) badge.textContent = String(getWishlistCount());
  });
}

function mount(): void {
  const root = document.getElementById("navbar-root");
  if (!root) return;

  cleanup?.abort();
  cleanup = new AbortController();
  const signal = cleanup.signal;

  if (announceTimer) {
    window.clearInterval(announceTimer);
    announceTimer = undefined;
  }

  const main = document.querySelector("main");
  if (main && !main.id) main.id = "main-content";

  document.body.classList.remove("drawer-open");
  drawerOpen = false;

  renderHeader(root);
  search = initSearch(signal);

  bindMega(signal);
  bindDrawer(signal);
  bindClicks(root, signal);
  startAnnounce(root, signal);
  bindScroll(signal);
}

export function initNavbar(): void {
  bindGlobal();
  initMiniCart();
  mount();
}

/** Re-renders the account area (call after login/logout without reload). */
export function refreshAccountArea(): void {
  const area = document.getElementById("account-area");
  if (area) {
    area.innerHTML = renderAccountArea();
    area.classList.remove("is-open");
  }
}
