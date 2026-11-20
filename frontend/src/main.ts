// ============================================================
// NEXUSPLAY — App entry point (multi-page router)
// ============================================================
import "./styles/main.scss";

import { initNavbar } from "./components/navbar";
import { initFooter } from "./components/footer";
import { initHomePage } from "./pages/home";
import { initShopPage } from "./pages/shop";
import { initProductPage, initWishlistPage } from "./pages/product";
import { initCartPage } from "./pages/cart";
import { initCheckoutPage } from "./pages/checkout";
import { initTrackPage } from "./pages/track";
import { initAuthPages } from "./pages/auth";
import { initAdminPage } from "./pages/admin";
import { bindProductCardNavigation } from "./components/productCard";

// New animation system
import { 
  initScrollReveal, 
  runEntranceChoreography,
  initViewTransitions,
  autoRegisterSharedElements,
} from "./animations";
import { initTilt3DDelegated, initMagnetic, initPressRippleDelegated } from "./animations/interaction/tilt-3d";

// -- Theme initialization --------------------------------------------
function initTheme(): void {
  const saved = localStorage.getItem("nexusplay_theme") as "light" | "dark" | null;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = saved ?? (prefersDark ? "dark" : "light");

  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("nexusplay_theme", theme);
}

function toggleTheme(): void {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("nexusplay_theme", next);
}

// -- Initialize all animation systems ----------------------------------
async function initAnimationSystems(): Promise<void> {
  const page = document.body.dataset.page;
  
  // 1. View transitions (MPA navigation)
  initViewTransitions({
    sharedElements: {
      'product-image': '.shared-product-image',
      'cart-icon': '.navbar__cart-link',
      'site-logo': '.navbar__logo',
    },
    skipPaths: ['/admin', '/checkout'],
  });
  
  // 2. Scroll reveal with variants
  initScrollReveal([
    { selector: '.section__head', variant: 'section' },
    { selector: '.tile', variant: 'card' },
    { selector: '.trend-card', variant: 'card' },
    { selector: '.cat-tile', variant: 'card' },
    { selector: '.p-card', variant: 'card' },
    { selector: '.pd-layout', variant: 'section' },
    { selector: '.cart-layout', variant: 'section' },
    { selector: '.checkout-layout', variant: 'section' },
    { selector: '.track-result', variant: 'section' },
    { selector: '.page-message', variant: 'section' },
    { selector: '.stat-card', variant: 'stat' },
    { selector: '.btn, .hero__btn, .tile__btn, .p-card__btn', variant: 'cta' },
  ]);
  
  // 3. Entrance choreography
  await runEntranceChoreography(page ?? '');
  
  // 4. 3D tilt on cards/tiles (delegated for dynamic content)
  initTilt3DDelegated(document.body, '.p-card, .tile, .trend-card, .cat-tile', {
    maxAngle: 8,
    perspective: 1100,
    scale: 1.02,
  });
  
  // 5. Magnetic attraction on interactive elements (using initMagnetic for each)
  document.querySelectorAll<HTMLElement>('.btn, .hero__btn, .tile, .trend-card').forEach(el => {
    initMagnetic(el, { radius: 40, strength: 0.25 });
  });
  
  // 6. Press ripple on buttons
  initPressRippleDelegated(document.body, 'button, .btn, .hero__btn, .tile__btn, .p-card__btn');
  
  // 7. Auto-register shared elements from data attributes
  autoRegisterSharedElements();
  
  // Homepage presentation uses lightweight CSS motion; avoid loading Three.js on every route.
}

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initNavbar();
  initFooter();
  bindProductCardNavigation();
  
  // Initialize animation systems before page content
  await initAnimationSystems();
  
  const page = document.body.dataset.page;

  switch (page) {
    case "home":
      initHomePage();
      break;
    case "shop":
      initShopPage();
      break;
    case "product":
      initProductPage();
      break;
    case "cart":
      initCartPage();
      break;
    case "wishlist":
      initWishlistPage();
      break;
    case "checkout":
      initCheckoutPage();
      break;
    case "track":
      initTrackPage();
      break;
    case "login":
    case "register":
      initAuthPages();
      break;
    case "admin":
      initAdminPage();
      break;
    default:
      // Unknown data-page → simple 404 message (never a blank screen)
      document.querySelector("main")?.insertAdjacentHTML(
        "afterbegin",
        `<div class="page-message reveal reveal--section">
           <span style="font-size:3rem">🧭</span>
           <h2>Page not found</h2>
           <p>The page you're looking for doesn't exist.</p>
           <a class="btn btn--dark" href="/">Back to Home</a>
         </div>`,
      );
      break;
  }
});

export { toggleTheme };