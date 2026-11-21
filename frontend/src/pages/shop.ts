// ============================================================
// NEXUSPLAY — Shop page (URL-synced filters, sorting, pagination)
// Existing query names and product-card interactions are preserved.
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
  page: number;
}

const PAGE_SIZE = 24;

const CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "controllers", label: "Controllers" },
  { value: "keyboards", label: "Keyboards" },
  { value: "mice", label: "Mice" },
  { value: "other", label: "Accessories" },
];

const BRANDS = [
  { value: "", label: "All brands" },
  { value: "GameSir", label: "GameSir" },
  { value: "Flydigi", label: "Flydigi" },
  { value: "8BitDo", label: "8BitDo" },
  { value: "EasySMX", label: "EasySMX" },
];

const STOCKS = [
  { value: "", label: "Any availability" },
  { value: "in-stock", label: "In stock" },
  { value: "pre-order", label: "Pre-order" },
  { value: "out-of-stock", label: "Out of stock" },
];

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "discount", label: "Biggest discount" },
];

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    return entities[char];
  });
}

function readState(): ShopState {
  const params = new URLSearchParams(window.location.search);
  const rawMax = Number(params.get("max"));
  const rawPage = Number(params.get("page"));
  const requestedSort = params.get("sort") ?? "featured";

  return {
    category: params.get("category") ?? undefined,
    brand: params.get("brand") ?? undefined,
    stock: params.get("stock") ?? undefined,
    max: Number.isFinite(rawMax) && rawMax > 0 ? rawMax : undefined,
    sort: SORTS.some((sort) => sort.value === requestedSort) ? requestedSort : "featured",
    q: params.get("q") ?? undefined,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

function writeState(state: ShopState): void {
  const params = new URLSearchParams();
  if (state.category) params.set("category", state.category);
  if (state.brand) params.set("brand", state.brand);
  if (state.stock) params.set("stock", state.stock);
  if (state.max) params.set("max", String(state.max));
  if (state.sort !== "featured") params.set("sort", state.sort);
  if (state.q) params.set("q", state.q);
  if (state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
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
        ${options.map((option) => `
          <label class="filter-option">
            <input type="radio" name="${name}" value="${option.value}"
              ${(current ?? "") === option.value ? "checked" : ""} />
            <span>${option.label}</span>
          </label>`).join("")}
      </div>
    </div>`;
}

function countActiveFilters(state: ShopState): number {
  return [state.category, state.brand, state.stock, state.max, state.q]
    .filter((value) => value !== undefined && value !== "").length;
}

function renderFilters(state: ShopState): string {
  return `
    <div class="filter-panel__head">
      <div>
        <span class="filter-panel__eyebrow">REFINE YOUR SEARCH</span>
        <h2>Filters <span class="filter-panel__active" id="filter-panel-count">${countActiveFilters(state)}</span></h2>
      </div>
      <button class="filter-panel__close" id="filters-close" type="button" aria-label="Close filters">×</button>
    </div>

    <div class="filter-panel__body">
      <div class="filter-group filter-group--search">
        <label class="filter-group__title" for="filter-q">Search products</label>
        <div class="filter-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input type="search" id="filter-q" class="filter-search"
            placeholder="Search controllers, brands…" value="${escapeHtml(state.q ?? "")}" />
        </div>
      </div>

      ${filterGroup("Category", "f-category", CATEGORIES, state.category)}
      ${filterGroup("Brand", "f-brand", BRANDS, state.brand)}
      ${filterGroup("Availability", "f-stock", STOCKS, state.stock)}

      <div class="filter-group filter-group--price">
        <div class="filter-group__title">Maximum price <strong id="price-label">${state.max ? `BDT ${state.max.toLocaleString()}` : "Any price"}</strong></div>
        <input type="range" id="filter-max" min="2000" max="21000" step="500"
          value="${state.max ?? 21000}" aria-label="Maximum price in taka" />
        <div class="filter-price-scale"><span>৳2,000</span><span>৳21,000+</span></div>
      </div>
    </div>

    <div class="filter-panel__foot">
      <button class="filter-clear" id="filter-clear" type="button">Clear all filters</button>
      <span>Curated for your setup</span>
    </div>`;
}

function skeletonCard(): string {
  return `
    <article class="p-card p-card--skeleton" aria-hidden="true">
      <div class="p-card__media"><span class="sk sk-media"></span></div>
      <div class="p-card__body">
        <span class="sk sk-brand"></span>
        <span class="sk sk-name"></span>
        <span class="sk sk-name sk-name--short"></span>
        <span class="sk sk-meta"></span>
        <span class="sk sk-price"></span>
      </div>
    </article>`;
}

async function fetchProducts(state: ShopState): Promise<PagedResult<Product>> {
  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(PAGE_SIZE),
    sort: state.sort,
  });
  if (state.category) params.set("category", state.category);
  if (state.brand) params.set("brand", state.brand);
  if (state.stock) params.set("stock", state.stock);
  if (state.max) params.set("max", String(state.max));
  if (state.q) params.set("q", state.q);

  try {
    return await api.get<PagedResult<Product>>(`/products?${params.toString()}`);
  } catch {
    let items = [...localProducts];
    if (state.category) items = items.filter((product) => product.category === state.category);
    if (state.brand) items = items.filter((product) => product.brand === state.brand);
    if (state.stock) items = items.filter((product) => product.stock === state.stock);
    if (state.max) items = items.filter((product) => product.price <= state.max!);
    if (state.q) {
      const query = state.q.toLowerCase();
      items = items.filter((product) =>
        product.name.toLowerCase().includes(query) ||
        product.brand.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query)
      );
    }

    if (state.sort === "price-asc") items.sort((a, b) => a.price - b.price);
    if (state.sort === "price-desc") items.sort((a, b) => b.price - a.price);
    if (state.sort === "discount") {
      items.sort((a, b) => (b.oldPrice - b.price) - (a.oldPrice - a.price));
    }
    if (state.sort === "newest") {
      items.sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
    }

    const total = items.length;
    const start = (state.page - 1) * PAGE_SIZE;
    return {
      items: items.slice(start, start + PAGE_SIZE),
      total,
      page: state.page,
      pageSize: PAGE_SIZE,
    };
  }
}

function renderPagination(
  host: HTMLElement | null,
  page: number,
  totalPages: number,
): void {
  if (!host) return;
  if (totalPages <= 1) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = `
    <button class="shop-page-btn shop-page-btn--arrow" type="button" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">←</button>
    <span class="shop-page-status">PAGE <strong>${page}</strong> OF <strong>${totalPages}</strong></span>
    <button class="shop-page-btn shop-page-btn--arrow" type="button" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="Next page">→</button>`;
}

export function initShopPage(): void {
  const grid = document.getElementById("shop-grid");
  const count = document.getElementById("shop-count");
  const sidebar = document.getElementById("shop-filters");
  const pagination = document.getElementById("shop-pagination");
  const filterToggle = document.getElementById("filters-toggle");
  const backdrop = document.getElementById("shop-filter-backdrop");
  const sortSelect = document.getElementById("shop-sort") as HTMLSelectElement | null;

  if (!grid || !sidebar) return;

  let state = readState();
  let queryTimer: ReturnType<typeof setTimeout> | null = null;
  let renderSequence = 0;

  const syncFilterBadge = (): void => {
    const activeCount = countActiveFilters(state);
    const badge = document.getElementById("filter-count");
    const panelCount = document.getElementById("filter-panel-count");
    if (badge) badge.textContent = String(activeCount);
    if (panelCount) panelCount.textContent = String(activeCount);
    filterToggle?.setAttribute("aria-expanded", String(sidebar.classList.contains("is-open")));
  };

  const closeFilters = (): void => {
    sidebar.classList.remove("is-open");
    backdrop?.classList.remove("is-visible");
    document.body.classList.remove("filters-open");
    filterToggle?.setAttribute("aria-expanded", "false");
  };

  const openFilters = (): void => {
    sidebar.classList.add("is-open");
    backdrop?.classList.add("is-visible");
    document.body.classList.add("filters-open");
    filterToggle?.setAttribute("aria-expanded", "true");
    sidebar.querySelector<HTMLButtonElement>("#filters-close")?.focus();
  };

  const updateSidebar = (): void => {
    sidebar.innerHTML = renderFilters(state);
    syncFilterBadge();
  };

  const render = async (): Promise<void> => {
    const currentSequence = ++renderSequence;
    grid.innerHTML = skeletonCard().repeat(8);
    const result = await fetchProducts(state);
    if (currentSequence !== renderSequence) return;

    const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
    if (state.page > totalPages) {
      state.page = totalPages;
      writeState(state);
      await render();
      return;
    }

    if (count) {
      const from = result.total === 0 ? 0 : (state.page - 1) * PAGE_SIZE + 1;
      const to = Math.min(state.page * PAGE_SIZE, result.total);
      count.textContent = result.total === 0
        ? "No products found"
        : `Showing ${from}–${to} of ${result.total} products`;
    }

    grid.innerHTML = result.items.length > 0
      ? result.items.map(productCard).join("")
      : `<div class="shop-empty">
           <span aria-hidden="true">⌕</span>
           <h3>No products found</h3>
           <p>Try another search or clear a filter to see more hardware.</p>
           <button class="shop-empty__clear" type="button" data-clear-filters>Clear filters</button>
         </div>`;

    renderPagination(pagination, state.page, totalPages);
  };

  updateSidebar();
  if (sortSelect) sortSelect.value = state.sort;

  sidebar.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.name === "f-category") state.category = input.value || undefined;
    if (input.name === "f-brand") state.brand = input.value || undefined;
    if (input.name === "f-stock") state.stock = input.value || undefined;
    if (input.id === "filter-max") {
      const value = Number(input.value);
      state.max = value >= 21000 ? undefined : value;
    }
    state.page = 1;
    writeState(state);
    syncFilterBadge();
    void render();
  });

  sidebar.addEventListener("input", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.id === "filter-max") {
      const label = document.getElementById("price-label");
      const value = Number(input.value);
      if (label) label.textContent = value >= 21000 ? "Any price" : `BDT ${value.toLocaleString()}`;
      return;
    }

    if (input.id !== "filter-q") return;
    if (queryTimer) clearTimeout(queryTimer);
    queryTimer = setTimeout(() => {
      state.q = input.value.trim() || undefined;
      state.page = 1;
      writeState(state);
      syncFilterBadge();
      void render();
    }, 350);
  });

  sidebar.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("#filters-close")) {
      closeFilters();
      filterToggle?.focus();
      return;
    }
    if (target.closest("#filter-clear")) {
      state = { sort: "featured", page: 1 };
      writeState(state);
      updateSidebar();
      if (sortSelect) sortSelect.value = "featured";
      void render();
      return;
    }
  });

  filterToggle?.addEventListener("click", openFilters);
  backdrop?.addEventListener("click", closeFilters);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("is-open")) {
      closeFilters();
      filterToggle?.focus();
    }
  });

  sortSelect?.addEventListener("change", () => {
    state.sort = sortSelect.value;
    state.page = 1;
    writeState(state);
    void render();
  });

  pagination?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-page]");
    if (!button || button.disabled) return;
    const nextPage = Number(button.dataset.page);
    if (!Number.isInteger(nextPage) || nextPage < 1) return;
    state.page = nextPage;
    writeState(state);
    void render();
    document.querySelector(".shop-toolbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  grid.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("[data-clear-filters]")) {
      state = { sort: "featured", page: 1 };
      writeState(state);
      updateSidebar();
      if (sortSelect) sortSelect.value = "featured";
      void render();
    }
  });

  void render();
}
