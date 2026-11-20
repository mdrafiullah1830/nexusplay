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

const REPOSITORY_ART_ROOT =
  "https://raw.githubusercontent.com/mdrafiullah1830/nexusplay/main/product_images";

const LOCAL_PRODUCT_ART: Record<string, string> = {
  "8bitdo-ultimate-2c": REPOSITORY_ART_ROOT + "/8BitDo_Ultimate_2c/01_angle.png",
  "gamesir-g7-pro-8k-phantom-blade": REPOSITORY_ART_ROOT + "/GameSir_G7_Pro_8K_PC_Phantom_Blade_Zero_Limited_Edition/01_angle.webp",
  "flydigi-apex-6-pro": REPOSITORY_ART_ROOT + "/Flydigi_Apex_6_Pro/01_angle.webp",
  "flydigi-apex-6-pro-shadow-blade": REPOSITORY_ART_ROOT + "/Flydigi_Apex_6_Pro_Shadow_Blade_Zero_Limited_Edition/01_angle.webp",
  "gamesir-cyclone-2": REPOSITORY_ART_ROOT + "/GameSir_Cyclone_2/01_angle.png",
  "gamesir-g7-pro": REPOSITORY_ART_ROOT + "/GameSir_G7_pro/01_angle.png",
  "gamesir-g7-pro-wuchang": REPOSITORY_ART_ROOT + "/GameSir_G7_pro_Wuchang_Limited_edition/01_angle.png",
  "gamesir-g7-pro-8k-black": REPOSITORY_ART_ROOT + "/GameSir_G7_Pro_8k_PC_Black_Edition/01_angle.png",
  "gamesir-g7-pro-8k-aimlabs": REPOSITORY_ART_ROOT + "/GameSir_G7_pro_8k_pc_Aimlabs_edition/01_angle.png",
  "gamesir-tarantula-8k": REPOSITORY_ART_ROOT + "/GameSir_Tarantula_8k_pc/01_angle.png",
  "flydigi-vader-5-pro": REPOSITORY_ART_ROOT + "/Flydigi_Vader_5_pro/01_angle.png",
  "flydigi-apex-5": REPOSITORY_ART_ROOT + "/Flydigi_Apex_5/01_angle.png",
  "dock-2-pro": REPOSITORY_ART_ROOT + "/Flydigi_Dock_2_Pro/01_angle.png",
  "flydigi-bs2-pro": REPOSITORY_ART_ROOT + "/Flydigi_BS2_Pro/01_angle.png",
  "flydigi-bs3-pro": REPOSITORY_ART_ROOT + "/Flydigi_BS3_Pro/01_angle.png",
  "8bitdo-ultimate-2": REPOSITORY_ART_ROOT + "/8BitDo_Ultimate_2/01_angle.png",
  "gamesir-nova-2-lite": REPOSITORY_ART_ROOT + "/GameSir_Nova_2_lite/01_angle.png",
  "flydigi-vader-5-pro-with-dock": REPOSITORY_ART_ROOT + "/Flydigi_Vader_5_pro_with_Dock/01_angle.png",
  "flydigi-apex-5-with-dock": REPOSITORY_ART_ROOT + "/Flydigi_Apex_5_With_Dock/01_angle.png",
  "flydigi-direwolf-4": REPOSITORY_ART_ROOT + "/Flydigi_Direwolf_4/01_angle.png",
  "easysmx-xo5-pro": REPOSITORY_ART_ROOT + "/EasySMX_XO5_Pro/01_angle.png",
  "easysmx-d10": REPOSITORY_ART_ROOT + "/EasySMX_D10/01_angle.png",
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
  const firstImage = p.imageUrls?.[0] || p.image || LOCAL_PRODUCT_ART[p.id];

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
