// ============================================================
// NEXUSPLAY — Product Card component
// ============================================================
import type { Product } from "../types";
import { cart, formatBDT } from "../services/cart";
import { toast } from "../services/toast";

const CATEGORY_EMOJI: Record<string, string> = {
  controllers: "🎮",
  keyboards: "⌨️",
  mice: "🖱️",
  other: "🔌",
};

const BRAND_TINT: Record<string, string> = {
  GameSir: "linear-gradient(145deg, #2b3a55, #101725)",
  Flydigi: "linear-gradient(145deg, #3d2b2b, #1a0f0f)",
  "8BitDo": "linear-gradient(145deg, #3f4d24, #171d0d)",
  EasySMX: "linear-gradient(145deg, #3a2f4d, #150f1e)",
};

/** Products rendered on the page, keyed by id (for card interactions). */
const registry = new Map<string, Product>();

export function registerProducts(list: Product[]): void {
  list.forEach((p) => registry.set(p.id, p));
}

function badgeFor(p: Product): { text: string; cls: string } | null {
  const save = p.oldPrice - p.price;
  if (p.stock === "out-of-stock") return { text: "Out of Stock", cls: "p-card__badge--muted" };
  if (p.stock === "pre-order") return { text: "Pre-order", cls: "p-card__badge--dark" };
  if (save > 0) return { text: `Save ${formatBDT(save)}`, cls: "" };
  return null;
}

function actionFor(p: Product): { label: string; disabled: boolean } {
  if (p.stock === "out-of-stock") return { label: "Out of Stock", disabled: true };
  if (p.stock === "pre-order") return { label: "Add to cart", disabled: false };
  return { label: p.colours?.length ? "Select" : "Add to cart", disabled: false };
}

function metaFor(p: Product): string {
  if (p.connectivity) return p.connectivity;
  if (p.cooling) return p.cooling;
  if (p.charging) return p.charging;
  return p.compatibility.join(", ");
}

export function productCard(p: Product): string {
  registry.set(p.id, p);

  const badge = badgeFor(p);
  const action = actionFor(p);
  const tint = BRAND_TINT[p.brand] ?? "linear-gradient(145deg, #2a2a2a, #0f0f0f)";
  const firstImage = p.imageUrls?.[0];

  return `
    <article class="p-card reveal reveal--card" data-id="${p.id}" tabindex="0">
      <div class="p-card__media">
        ${badge ? `<span class="p-card__badge ${badge.cls}">${badge.text}</span>` : ""}
        <div class="p-card__img" style="background:${tint};">
          ${firstImage
            ? `<img src="${firstImage}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" />`
            : `<span style="filter:drop-shadow(0 8px 16px rgba(0,0,0,.4));font-size:clamp(3.5rem,7vw,5.5rem);">${CATEGORY_EMOJI[p.category] ?? "🎮"}</span>`}
        </div>
      </div>
      <div class="p-card__body">
        <div class="p-card__brand">${p.brand}</div>
        <div class="p-card__name">${p.name}</div>
        <div class="p-card__meta">${metaFor(p)}</div>
        <div class="p-card__price">
          <strong>${formatBDT(p.price)}</strong>
          ${p.oldPrice > p.price ? `<del>${formatBDT(p.oldPrice)}</del>` : ""}
        </div>
        <div class="p-card__actions">
          <button class="p-card__btn ${action.disabled ? "p-card__btn--disabled" : ""}"
                  data-action="card-buy" ${action.disabled ? "disabled" : ""}>${action.label}</button>
        </div>
      </div>
    </article>`;
}

let navigationBound = false;

/** Delegated click handling for every product card on the page. */
export function bindProductCardNavigation(): void {
  if (navigationBound) return;
  navigationBound = true;

  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>(".p-card[data-id]");
    if (!card) return;

    const product = registry.get(card.dataset.id ?? "");
    if (!product) return;

    const button = target.closest<HTMLButtonElement>("[data-action='card-buy']");

    // Card body / media click → product detail
    if (!button) {
      window.location.href = `/product.html?id=${encodeURIComponent(product.id)}`;
      return;
    }

    if (button.disabled) return;

    if (product.colours?.length && product.stock === "in-stock") {
      // Colour choice happens on the detail page
      window.location.href = `/product.html?id=${encodeURIComponent(product.id)}`;
      return;
    }

    cart.add(product, 1);
    toast(`Added — ${product.name}`);
  });

  // Keyboard: Enter on a focused card opens it
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = (e.target as HTMLElement).closest<HTMLElement>(".p-card[data-id]");
    if (card && (e.target as HTMLElement).classList.contains("p-card")) {
      window.location.href = `/product.html?id=${encodeURIComponent(card.dataset.id ?? "")}`;
    }
  });
}
