// ============================================================
// NEXUSPLAY — App entry point (multi-page router)
// ============================================================
import "./styles/main.scss";
import { initNavbar } from "./components/navbar";
import { initFooter } from "./components/footer";
import { initHeroSlider } from "./components/heroSlider";
import { initHomePage } from "./pages/home";
import { initShopPage } from "./pages/shop";
import { initProductPage, initWishlistPage } from "./pages/product";
import { initCartPage } from "./pages/cart";
import { initCheckoutPage } from "./pages/checkout";
import { initTrackPage } from "./pages/track";
import { initAuthPages } from "./pages/auth";
import { initAdminPage } from "./pages/admin";
import { bindProductCardNavigation } from "./components/productCard";
import { initAnimations } from "./components/animations";

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

// -- Page enter animation --------------------------------------------
function initPageEnter(): void {
  document.body.classList.add("page-enter");
  // Remove the enter class after the animation completes
  setTimeout(() => {
    document.body.classList.remove("page-enter");
  }, 500);
}

// -- Page transition overlay -----------------------------------------
let transitionOverlay: HTMLElement | null = null;

function initPageTransition(): void {
  transitionOverlay = document.createElement("div");
  transitionOverlay.className = "page-transition";
  document.body.appendChild(transitionOverlay);
}


// (triggerPageTransition is wired up when navigation links are migrated)
// Kept for future page-transition integration.

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initPageEnter();
  initPageTransition();
  initNavbar();
  initFooter();
  bindProductCardNavigation();
  // Before the page switch so the reveal MutationObserver is alive
  // when pages inject their dynamic content (cards, results, …).
  initAnimations();

  const page = document.body.dataset.page;

  switch (page) {
    case "home":
      initHeroSlider();
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
        `<div class="page-message">
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
