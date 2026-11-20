// ============================================================
// NEXUSPLAY — Home page rendering (API-first, local fallback)
// ============================================================
import { products as localProducts } from "../data/products";
import { productCard } from "../components/productCard";
import { api } from "../services/api";
import type { Product, PagedResult } from "../types";

function renderInto(selector: string, html: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.innerHTML = html;
}

async function loadProducts(): Promise<Product[]> {
  try {
    const res = await api.get<PagedResult<Product>>("/products?pageSize=100&sort=featured");
    return res.items.length > 0 ? res.items : localProducts;
  } catch {
    return localProducts; // backend offline → static fallback so the page still works
  }
}

export async function initHomePage(): Promise<void> {
  // Featured tiles → 4 categories
  const tiles = [
    { label: "Controller Wall", sub: "22+ pro controllers", href: "/shop.html?category=controllers", bg: "g1" },
    { label: "Pre-Order Now", sub: "Limited editions", href: "/shop.html?stock=pre-order", bg: "g2" },
    { label: "Budget Picks", sub: "Under BDT 5,000", href: "/shop.html?max=5000", bg: "g3" },
    { label: "Docks & Cooling", sub: "Gear up your setup", href: "/shop.html?category=other", bg: "g4" },
  ];

  renderInto(
    "#featured-grid",
    tiles
      .map(
        (t) => `
      <a class="tile reveal reveal--card" href="${t.href}">
        <div class="tile__bg tile__bg--${t.bg}"></div>
        <div class="tile__label">${t.label}</div>
        <div class="tile__sub">${t.sub}</div>
        <span class="tile__btn">Shop</span>
      </a>`,
      )
      .join(""),
  );

  // Trending row
  const trending = [
    { title: "GameSir 8K", cta: "Shop now", bg: "t1", href: "/shop.html?brand=GameSir" },
    { title: "Flydigi Apex", cta: "Shop now", bg: "t2", href: "/shop.html?brand=Flydigi" },
    { title: "8BitDo", cta: "Shop now", bg: "t3", href: "/shop.html?brand=8BitDo" },
    { title: "EasySMX", cta: "Shop now", bg: "t4", href: "/shop.html?brand=EasySMX" },
  ];

  renderInto(
    "#trending-row",
    trending
      .map(
        (t) => `
      <a class="trend-card reveal reveal--card" href="${t.href}">
        <div class="trend-card__bg trend-card__bg--${t.bg}"></div>
        <div>
          <div class="trend-card__title">${t.title}</div>
          <div class="trend-card__cta">${t.cta}</div>
        </div>
      </a>`,
      )
      .join(""),
  );

  const all = await loadProducts();

  // Bestsellers — in stock first, then by rating
  const rank = (s: string): number => (s === "in-stock" ? 0 : s === "pre-order" ? 1 : 2);
  const bestsellers = [...all]
    .sort((a, b) => rank(a.stock) - rank(b.stock) || b.rating - a.rating)
    .slice(0, 10);
  renderInto("#bestseller-rail", bestsellers.map(productCard).join(""));

  // Biggest savings — by discount amount
  const savings = [...all]
    .sort((a, b) => b.oldPrice - b.price - (a.oldPrice - a.price))
    .slice(0, 10);
  renderInto("#new-rail", savings.map(productCard).join(""));

  // Category tiles
  const cats = [
    { name: "Controllers", emoji: "🎮", href: "/shop.html?category=controllers" },
    { name: "Keyboards", emoji: "⌨️", href: "/shop.html?category=keyboards" },
    { name: "Mice", emoji: "🖱️", href: "/shop.html?category=mice" },
    { name: "Docks", emoji: "🔌", href: "/shop.html?category=other" },
    { name: "Cooling", emoji: "❄️", href: "/shop.html?category=other" },
  ];

  renderInto(
    "#cat-row",
    cats
      .map(
        (c) => `
      <a class="cat-tile reveal reveal--card" href="${c.href}">
        <div class="cat-tile__circle">${c.emoji}</div>
        <div class="cat-tile__name">${c.name}</div>
      </a>`,
      )
      .join(""),
  );
}
