// ============================================================
// CTRLZONEBD — Header search overlay
// Instant client-side search over the static catalogue.
// ============================================================
import { products } from "../data/products";
import type { PagedResult, Product } from "../types";
import { formatBDT } from "../services/cart";
import { t } from "../services/i18n";
import { api } from "../services/api";

/** Debounce window for live search — long enough to avoid a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 220;

const RECENT_KEY = "nexusplay_recent_searches";
const MAX_RECENT = 5;
const MAX_RESULTS = 7;

const EMOJI: Record<string, string> = {
  controllers: "🎮",
  keyboards: "⌨️",
  mice: "🖱️",
  other: "🎧",
};

const TINT: Record<string, string> = {
  GameSir: "linear-gradient(145deg,#2b3a55,#101725)",
  Flydigi: "linear-gradient(145deg,#3d2b2b,#1a0f0f)",
  "8BitDo": "linear-gradient(145deg,#3f4d24,#171d0d)",
  EasySMX: "linear-gradient(145deg,#3a2f4d,#150f1e)",
};

export interface SearchApi {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function addRecent(query: string): void {
  const value = query.trim();
  if (!value) return;
  const next = [value, ...readRecent().filter((q) => q.toLowerCase() !== value.toLowerCase())].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — recent searches are optional */
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch];
  });
}

function searchCatalogue(raw: string): Product[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];

  return products
    .map((product) => {
      const name = product.name.toLowerCase();
      const brand = product.brand.toLowerCase();
      let score = 0;
      if (name.startsWith(q)) score = 4;
      else if (name.includes(q)) score = 3;
      else if (brand.includes(q)) score = 2;
      else {
        const haystack = `${product.category} ${product.connectivity ?? ""} ${product.compatibility.join(" ")}`.toLowerCase();
        if (haystack.includes(q)) score = 1;
      }
      return { product, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating)
    .slice(0, MAX_RESULTS)
    .map((row) => row.product);
}

function resultRow(product: Product, index: number): string {
  const tint = TINT[product.brand] ?? "linear-gradient(145deg,#2a2a2a,#0f0f0f)";
  const emoji = EMOJI[product.category] ?? "🎮";
  const category = product.category === "other" ? "Accessories" : product.category;

  return `
    <a class="search-result" id="search-opt-${index}" role="option" aria-selected="false"
       href="/product.html?id=${encodeURIComponent(product.id)}" data-search-result data-query="${escapeHtml(product.name)}">
      <span class="search-result__thumb" style="background:${tint}">${emoji}</span>
      <span class="search-result__text">
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.brand)} · ${escapeHtml(category)}</small>
      </span>
      <span class="search-result__price">${formatBDT(product.price)}</span>
    </a>`;
}

function chip(label: string, value: string, kind: "recent" | "popular"): string {
  if (kind === "popular" && value.startsWith("/")) {
    return `<a class="search-chip" href="${value}" data-search-link>${escapeHtml(label)}</a>`;
  }
  return `<button class="search-chip" type="button" data-search-q="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

export function initSearch(signal: AbortSignal): SearchApi {
  const panel = document.getElementById("search-panel");
  const button = document.getElementById("search-btn");
  const input = document.getElementById("search-input") as HTMLInputElement | null;
  const results = document.getElementById("search-results");
  const closeButton = document.getElementById("search-close");

  const noop: SearchApi = {
    open: () => undefined,
    close: () => undefined,
    toggle: () => undefined,
    isOpen: () => false,
  };

  if (!panel || !button || !input || !results || !closeButton) return noop;

  let activeIndex = -1;
  let queryToken = 0;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  const rows = (): HTMLElement[] => Array.from(results.querySelectorAll<HTMLElement>(".search-result"));

  const setActive = (index: number): void => {
    const items = rows();
    if (items.length === 0) {
      activeIndex = -1;
      return;
    }
    activeIndex = ((index % items.length) + items.length) % items.length;
    items.forEach((row, i) => {
      const isActive = i === activeIndex;
      row.classList.toggle("is-active", isActive);
      row.setAttribute("aria-selected", String(isActive));
    });
    items[activeIndex].scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", items[activeIndex].id);
  };

  const clearActive = (): void => {
    activeIndex = -1;
    rows().forEach((row) => {
      row.classList.remove("is-active");
      row.setAttribute("aria-selected", "false");
    });
    input.removeAttribute("aria-activedescendant");
  };

  const renderIdle = (): void => {
    const recent = readRecent();
    const popular: { label: string; value: string }[] = [
      { label: "GameSir", value: "GameSir" },
      { label: "Flydigi", value: "Flydigi" },
      { label: "8BitDo", value: "8BitDo" },
      { label: t("mega.under5k"), value: "/shop.html?max=5000" },
    ];

    const recentBlock = recent.length
      ? `<div class="search-panel__section">
           <div class="search-panel__title">${t("search.recent")}</div>
           <div class="search-chips">${recent.map((q) => chip(q, q, "recent")).join("")}</div>
         </div>`
      : "";

    results.innerHTML = `
      ${recentBlock}
      <div class="search-panel__section">
        <div class="search-panel__title">${t("search.popular")}</div>
        <div class="search-chips">${popular.map((p) => chip(p.label, p.value, "popular")).join("")}</div>
      </div>`;
    results.setAttribute("role", "presentation");
    input.setAttribute("aria-expanded", "false");
    clearActive();
  };

  const renderQuery = async (raw: string): Promise<void> => {
    const q = raw.trim();
    if (!q) {
      renderIdle();
      return;
    }

    // Token guard: only the newest query may paint, so a slow response for an
    // earlier keystroke can't overwrite newer results.
    const token = ++queryToken;

    results.innerHTML = `<div class="search-empty">
      <span>🔎</span>
      <p>${t("search.searching")}</p>
    </div>`;
    results.setAttribute("role", "presentation");
    input.setAttribute("aria-expanded", "false");
    clearActive();

    let matches: Product[] = [];
    try {
      const res = await api.get<PagedResult<Product>>(
        `/products?q=${encodeURIComponent(q)}&pageSize=${MAX_RESULTS}&sort=featured`,
      );
      if (token === queryToken) matches = res.items.slice(0, MAX_RESULTS);
    } catch {
      // API offline / rate limited → fall back to the bundled catalogue
    }

    if (token !== queryToken) return;

    if (matches.length === 0) matches = searchCatalogue(q);

    if (matches.length === 0) {
      results.innerHTML = `<div class="search-empty">
        <span>🔎</span>
        <p>${t("search.empty")}</p>
      </div>`;
      results.setAttribute("role", "presentation");
      input.setAttribute("aria-expanded", "false");
      clearActive();
      return;
    }

    results.innerHTML = `
      <div class="search-results" role="presentation">
        ${matches.map(resultRow).join("")}
      </div>
      <a class="search-all" href="/shop.html?q=${encodeURIComponent(q)}" data-search-link>
        ${t("search.viewall")} →
      </a>`;
    results.setAttribute("role", "listbox");
    input.setAttribute("aria-expanded", "true");
    clearActive();
  };

  const open = (): void => {
    panel.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
    input.focus();
    input.select();
    if (input.value.trim()) void renderQuery(input.value);
    else renderIdle();
  };

  const close = (restoreFocus = false): void => {
    const wasOpen = panel.classList.contains("is-open");
    panel.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
    clearActive();
    if (restoreFocus && wasOpen) button.focus();
  };

  const submit = (): void => {
    const q = input.value.trim();
    if (!q) return;
    addRecent(q);
    window.location.href = `/shop.html?q=${encodeURIComponent(q)}`;
  };

  button.addEventListener("click", open, { signal });
  closeButton.addEventListener("click", () => close(true), { signal });

  input.addEventListener("input", () => {
    if (searchTimer) clearTimeout(searchTimer);
    const value = input.value;
    searchTimer = setTimeout(() => void renderQuery(value), SEARCH_DEBOUNCE_MS);
  }, { signal });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter") {
      const items = rows();
      if (activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        addRecent(input.value);
        items[activeIndex].click();
      } else {
        event.preventDefault();
        submit();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  }, { signal });

  results.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const queryChip = target.closest<HTMLButtonElement>("[data-search-q]");
    if (queryChip) {
      input.value = queryChip.dataset.searchQ ?? "";
      void renderQuery(input.value);
      input.focus();
      return;
    }

    const result = target.closest<HTMLElement>("[data-search-result]");
    if (result) addRecent(result.dataset.query ?? input.value);

    if (target.closest("[data-search-link]")) close(false);
  }, { signal });

  // Click outside the panel (and outside the trigger) closes it.
  document.addEventListener("pointerdown", (event) => {
    if (!panel.classList.contains("is-open")) return;
    const target = event.target as Node;
    if (!panel.contains(target) && !button.contains(target)) close(false);
  }, { signal });

  return {
    open,
    close: () => close(true),
    toggle: () => (panel.classList.contains("is-open") ? close(true) : open()),
    isOpen: () => panel.classList.contains("is-open"),
  };
}
