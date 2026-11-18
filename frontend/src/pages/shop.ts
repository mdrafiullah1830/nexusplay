// ============================================================
// NEXUSPLAY — Shop page (filters + sort + URL sync)
// ============================================================
import { api } from "../services/api";
import { products as localProducts } from "../data/products";
import { productCard } from "../components/productCard";
import type { PagedResult, Product } from "../types";

interface ShopState {
  category?: string;
  brand?: string;
  stock?: string;
  max?: number;
  sort: string;
  q?: string;
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "controllers", label: "Controllers" },
  { value: "keyboards", label: "Keyboards" },
  { value: "mice", label: "Mice" },
  { value: "other", label: "Other Items" },
];

const BRANDS = [
  { value: "", label: "All" },
  { value: "GameSir", label: "GameSir" },
  { value: "Flydigi", label: "Flydigi" },
  { value: "8BitDo", label: "8BitDo" },
  { value: "EasySMX", label: "EasySMX" },
];

const STOCKS = [
  { value: "", label: "All" },
  { value: "in-stock", label: "In Stock" },
  { value: "pre-order", label: "Pre-order" },
  { value: "out-of-stock", label: "Out of Stock" },
];

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "discount", label: "Biggest discount" },
];
void SORTS; // sort options are rendered in shop.html

function readState(): ShopState {
  const p = new URLSearchParams(window.location.search);
  return {
    category: p.get("category") ?? undefined,
    brand: p.get("brand") ?? undefined,
    stock: p.get("stock") ?? undefined,
    max: p.get("max") ? Number(p.get("max")) : undefined,
    sort: p.get("sort") ?? "featured",
    q: p.get("q") ?? undefined,
  };
}

function writeState(state: ShopState): void {
  const p = new URLSearchParams();
  if (state.category) p.set("category", state.category);
  if (state.brand) p.set("brand", state.brand);
  if (state.stock) p.set("stock", state.stock);
  if (state.max) p.set("max", String(state.max));
  if (state.sort !== "featured") p.set("sort", state.sort);
  if (state.q) p.set("q", state.q);
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

function filterGroup(
  title: string,
  name: string,
  options: { value: string; label: string }[],
  current: string | undefined,
): string {
  return `
    <div class="filter-group">
      <div class="filter-group__title">${title}</div>
      <div class="filter-group__options">
        ${options
          .map(
            (o) => `
          <label class="filter-option">
            <input type="radio" name="${name}" value="${o.value}"
                   ${(current ?? "") === o.value ? "checked" : ""} />
            <span>${o.label}</span>
          </label>`,
          )
          .join("")}
      </div>
    </div>`;
}

async function fetchProducts(state: ShopState): Promise<Product[]> {
  const params = new URLSearchParams({ pageSize: "60", sort: state.sort });
  if (state.category) params.set("category", state.category);
  if (state.brand) params.set("brand", state.brand);
  if (state.stock) params.set("stock", state.stock);
  if (state.max) params.set("max", String(state.max));
  if (state.q) params.set("q", state.q);

  try {
    const res = await api.get<PagedResult<Product>>(`/products?${params.toString()}`);
    return res.items;
  } catch {
    // Backend offline → client-side fallback over the static catalogue
    let items = [...localProducts];
    if (state.category) items = items.filter((p) => p.category === state.category);
    if (state.brand) items = items.filter((p) => p.brand === state.brand);
    if (state.stock) items = items.filter((p) => p.stock === state.stock);
    if (state.max) items = items.filter((p) => p.price <= state.max!);
    if (state.q) {
      const q = state.q.toLowerCase();
      items = items.filter(
        (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q),
      );
    }
    if (state.sort === "price-asc") items.sort((a, b) => a.price - b.price);
    if (state.sort === "price-desc") items.sort((a, b) => b.price - a.price);
    if (state.sort === "discount")
      items.sort((a, b) => b.oldPrice - b.price - (a.oldPrice - a.price));
    return items;
  }
}

export function initShopPage(): void {
  const grid = document.getElementById("shop-grid");
  const count = document.getElementById("shop-count");
  const sidebar = document.getElementById("shop-filters");
  if (!grid || !sidebar) return;

  let state = readState();

  // Build filter UI
  sidebar.innerHTML = `
    <div class="filter-group">
      <div class="filter-group__title">Search</div>
      <input type="search" id="filter-q" class="filter-search"
             placeholder="Search controllers…" value="${state.q ?? ""}" />
    </div>
    ${filterGroup("Category", "f-category", CATEGORIES, state.category)}
    ${filterGroup("Brand", "f-brand", BRANDS, state.brand)}
    ${filterGroup("Availability", "f-stock", STOCKS, state.stock)}
    <div class="filter-group">
      <div class="filter-group__title">Max Price: <span id="price-label">${
        state.max ? `BDT ${state.max.toLocaleString()}` : "Any"
      }</span></div>
      <input type="range" id="filter-max" min="2000" max="21000" step="500"
             value="${state.max ?? 21000}" />
    </div>
    <button class="filter-clear" id="filter-clear">Clear all filters</button>`;

  const render = async (): Promise<void> => {
    grid.innerHTML = `<div class="shop-loading">Loading products…</div>`;
    const items = await fetchProducts(state);

    if (count) {
      count.textContent = `${items.length} product${items.length === 1 ? "" : "s"}`;
    }

    grid.innerHTML =
      items.length > 0
        ? items.map(productCard).join("")
        : `<div class="shop-empty">
             <span style="font-size:3rem">🎮</span>
             <h3>No products found</h3>
             <p>Try clearing some filters.</p>
           </div>`;
  };

  // Filter events
  sidebar.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.name === "f-category") state.category = input.value || undefined;
    if (input.name === "f-brand") state.brand = input.value || undefined;
    if (input.name === "f-stock") state.stock = input.value || undefined;
    writeState(state);
    void render();
  });

  const priceInput = document.getElementById("filter-max") as HTMLInputElement | null;
  priceInput?.addEventListener("input", () => {
    const label = document.getElementById("price-label");
    const val = Number(priceInput.value);
    if (label) label.textContent = val >= 21000 ? "Any" : `BDT ${val.toLocaleString()}`;
  });
  priceInput?.addEventListener("change", () => {
    const val = Number(priceInput.value);
    state.max = val >= 21000 ? undefined : val;
    writeState(state);
    void render();
  });

  const qInput = document.getElementById("filter-q") as HTMLInputElement | null;
  let qTimer: ReturnType<typeof setTimeout> | null = null;
  qInput?.addEventListener("input", () => {
    if (qTimer) clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      state.q = qInput.value.trim() || undefined;
      writeState(state);
      void render();
    }, 350);
  });

  document.getElementById("filter-clear")?.addEventListener("click", () => {
    state = { sort: "featured" };
    writeState(state);
    void initShopPage(); // rebuild sidebar with cleared state
  });

  // Sort dropdown (top bar)
  const sortSelect = document.getElementById("shop-sort") as HTMLSelectElement | null;
  if (sortSelect) {
    sortSelect.value = state.sort;
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      writeState(state);
      void render();
    });
  }

  // Mobile filter drawer
  document.getElementById("filters-toggle")?.addEventListener("click", () => {
    sidebar.classList.toggle("is-open");
  });

  void render();
}
