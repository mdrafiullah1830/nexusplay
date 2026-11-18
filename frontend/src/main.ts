// ============================================================
// NEXUSPLAY — App entry point (multi-page router)
// ============================================================
import "./styles/main.scss";
import { initNavbar } from "./components/navbar";
import { initFooter } from "./components/footer";
import { initHeroSlider } from "./components/heroSlider";
import { initHomePage } from "./pages/home";
import { initShopPage } from "./pages/shop";
import { initProductPage } from "./pages/product";
import { initCartPage } from "./pages/cart";
import { initCheckoutPage } from "./pages/checkout";
import { initTrackPage } from "./pages/track";
import { initAuthPages } from "./pages/auth";
import { initAdminPage } from "./pages/admin";
import { bindProductCardNavigation } from "./components/productCard";

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

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initPageEnter();
  initNavbar();
  initFooter();
  bindProductCardNavigation();

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
  }
});

export { toggleTheme };
