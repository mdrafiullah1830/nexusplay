// ============================================================
// NEXUSPLAY — Product detail page
// ============================================================
import { api } from "../services/api";
import { wishlist } from "../services/wishlist";
import { products as localProducts } from "../data/products";
import { productCard } from "../components/productCard";
import { cart, formatBDT } from "../services/cart";
import { toast } from "../services/toast";
import type { Product, PagedResult } from "../types";

const EMOJI: Record<string, string> = {
  controllers: "🎮",
  keyboards: "⌨️",
  mice: "🖱️",
  other: "🔌",
};

const stars = (rating: number): string => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  let starsHtml = "";
  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      starsHtml += '<span class="star star-filled">&#9733;</span>';
    } else if (i === fullStars && hasHalfStar) {
      starsHtml += '<span class="star star-half">&#9733;</span>';
    } else {
      starsHtml += '<span class="star star-empty">&#9733;</span>';
    }
  }
  return starsHtml;
};

const TINTS: Record<string, string> = {
  GameSir: "linear-gradient(145deg, #2b3a55, #101725)",
  Flydigi: "linear-gradient(145deg, #3d2b2b, #1a0f0f)",
  "8BitDo": "linear-gradient(145deg, #3f4d24, #171d0d)",
  EasySMX: "linear-gradient(145deg, #3a2f4d, #150f1e)",
};

function galleryHtml(p: Product): string {
  const tint = TINTS[p.brand] ?? "linear-gradient(145deg, #2a2a2a, #0f0f0f)";
  const emoji = EMOJI[p.category] ?? "🎮";
  const images = p.imageUrls?.length ? p.imageUrls : [];
  const hasImages = images.length > 0;
  const firstView = hasImages
    ? `<img src="${images[0]}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<span class="pd-gallery__emoji" style="transform:rotate(0deg)">${emoji}</span>`;
  const thumbs = hasImages
    ? images
        .map(
          (img, i) => `
          <button class="pd-thumb ${i === 0 ? "is-active" : ""}" data-src="${img}">
            <img src="${img}" alt="${p.name} ${i + 1}" style="width:100%;height:100%;object-fit:cover;" />
          </button>`,
        )
        .join("")
    : [{ rotate: "0deg" }, { rotate: "-18deg" }, { rotate: "14deg" }]
        .map(
          (v) => `
          <button class="pd-thumb" data-rotate="${v.rotate}" style="background:${tint}">
            <span>${emoji}</span>
          </button>`,
        )
        .join("");
  return `
    <div class="pd-gallery">
      <div class="pd-gallery__main" id="gallery-main" style="background:${tint}">${firstView}</div>
      <div class="pd-gallery__thumbs">${thumbs}</div>
    </div>`;
}

function specsHtml(p: Product): string {
  const rows: [string, string][] = [];
  if (p.compatibility?.length) rows.push(["Compatibility", p.compatibility.join(", ")]);
  if (p.connectivity) rows.push(["Connectivity", p.connectivity]);
  if (p.cooling) rows.push(["Cooling", p.cooling]);
  if (p.charging) rows.push(["Charging / Display", p.charging]);
  if (p.controller) rows.push(["Controller", p.controller]);
  if (p.dock) rows.push(["Dock", p.dock]);
  if (p.colours?.length) rows.push(["Colours", p.colours.join(" / ")]);
  return rows
    .map(
      ([k, v]) => `
      <div class="pd-spec-row">
        <div class="pd-spec-key">${k}</div>
        <div class="pd-spec-val">${v}</div>
      </div>`,
    )
    .join("");
}

function stockBadge(p: Product): string {
  if (p.stock === "in-stock") return `<span class="stock-badge stock-badge--in">In Stock</span>`;
  if (p.stock === "pre-order")
    return `<span class="stock-badge stock-badge--pre">Pre-order${p.advance ? ` · ${formatBDT(p.advance)} advance` : ""}</span>`;
  return `<span class="stock-badge stock-badge--out">Out of Stock</span>`;
}

async function loadRelated(p: Product): Promise<Product[]> {
  try {
    const res = await api.get<PagedResult<Product>>(
      `/products?category=${p.category}&pageSize=12&sort=featured`,
    );
    return res.items.filter((x) => x.id !== p.id).slice(0, 6);
  } catch {
    return localProducts.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 6);
  }
}

// ====================
// Wishlist Management
// ====================
let renderVersion = 0;

async function renderWishlist(): Promise<void> {
  const list = document.querySelector<HTMLElement>(".wishlist-list");
  const count = document.querySelector<HTMLElement>(".wishlist-count");
  const summary = document.querySelector<HTMLElement>(".wishlist-summary");
  if (!list || !count) return;
  const version = ++renderVersion;
  count.textContent = String(wishlist.count());
  list.textContent = "Loading saved products…";
  summary?.replaceChildren();
  try {
    const products = await wishlist.products();
    if (version !== renderVersion) return;
    list.replaceChildren();
    count.textContent = String(products.length);
    if (!products.length) list.textContent = "Your wishlist is empty";
    for (const p of products) {
      const row = document.createElement("div");
      row.className = "wishlist-item";
      const link = document.createElement("a");
      link.href = "/product.html?id=" + encodeURIComponent(p.productId);
      link.textContent = p.name + " — " + formatBDT(p.price);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-mini wishlist-remove";
      button.dataset.productId = p.productId;
      button.textContent = "Remove";
      row.append(link, button);
      list.append(row);
    }
    if (summary && products.length) summary.textContent = "Total: " + formatBDT(products.reduce((sum, p) => sum + p.price, 0));
  } catch {
    if (version === renderVersion) list.textContent = "Unable to load your wishlist. Please reload to retry.";
  }
}
document.addEventListener("wishlist:change", () => {
  document.querySelectorAll<HTMLButtonElement>(".wishlist-add").forEach(btn => {
    const saved = wishlist.has(btn.dataset.productId ?? "");
    btn.textContent = saved ? "♥ Added" : "♥ Wishlist";
    btn.setAttribute("aria-pressed", String(saved));
  });
  void renderWishlist();
});
document.addEventListener("click", async (event) => {
  if (!(event.target instanceof Element)) return;
  const btn = event.target.closest<HTMLButtonElement>(".wishlist-add, .wishlist-remove");
  const id = btn?.dataset.productId;
  if (!btn || !id || btn.disabled) return;
  btn.disabled = true;
  try {
    await wishlist.set(id, !btn.classList.contains("wishlist-remove") && !wishlist.has(id));
  } catch {
    toast("Unable to update wishlist. Please retry.", "error");
  } finally { btn.disabled = false; }
});
export function getWishlistCount(): number { return wishlist.count(); }
export function initWishlistPage(): void { void renderWishlist(); }

// ============================================================
// Page bootstrap
// ============================================================
export function initProductPage(): void {
  const root = document.getElementById("product-root");
  if (!root) return;

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    renderNotFound();
    return;
  }

  api
    .get<Product>(`/products/${encodeURIComponent(id)}`)
    .then(mount)
    .catch(() => {
      const local = localProducts.find((x) => x.id === id);
      if (local) mount(local);
      else renderNotFound();
    });
}

function renderNotFound(): void {
  const root = document.getElementById("product-root");
  if (root) {
    root.innerHTML = `
      <div class="page-message">
        <span style="font-size:3rem">🎮</span>
        <h2>Product not found</h2>
        <a class="btn btn--dark" href="/shop.html">Back to Shop</a>
      </div>`;
  }
}

function mount(product: Product): void {
  const root = document.getElementById("product-root");
  if (!root) return;

  const save = product.oldPrice - product.price;
  const disabled = product.stock === "out-of-stock";
  let selectedColour: string | undefined = product.colours?.length ? product.colours[0] : undefined;
  let qty = 1;

  void loadRelated(product).then((related) => {
    const rail = document.getElementById("related-rail");
    if (rail) rail.innerHTML = related.map(productCard).join("");
  });

  root.innerHTML = `
    <div class="container pd-breadcrumb">
      <a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>${product.brand}</span>
    </div>

    <div class="container pd-layout">
      ${galleryHtml(product)}

      <div class="pd-info">
        <div class="pd-brand">${product.brand}</div>
        <h1 class="pd-title">${product.name}</h1>

        <div class="pd-rating">
          <span class="stars">${stars(product.rating)}</span>
          <span>${product.rating.toFixed(1)}</span>
        </div>

        <div class="pd-price">
          <strong>${formatBDT(product.price)}</strong>
          <s>${formatBDT(product.oldPrice)}</s>
          ${save > 0 ? `<span class="pd-save">Save ${formatBDT(save)}</span>` : ""}
        </div>

        <div class="pd-stock">${stockBadge(product)}</div>

        ${
          product.colours?.length
            ? `
            <div class="pd-option">
              <div class="pd-option__label">Colour · <span id="colour-label">${selectedColour ?? "Choose one"}</span></div>
              <div class="pd-colours" id="colour-picker">
                ${product.colours
                  .map(
                    (c) =>
                      `<button class="pd-colour ${c === selectedColour ? "is-active" : ""}" data-colour="${c}">${c}</button>`,
                  )
                  .join("")}
              </div>
            </div>`
            : ""
        }

        <div class="pd-option">
          <div class="pd-option__label">Quantity</div>
          <div class="qty-stepper">
            <button id="qty-minus" type="button">−</button>
            <input id="qty-input" type="number" min="1" max="50" value="1" readonly />
            <button id="qty-plus" type="button">+</button>
          </div>
        </div>

        <div class="pd-actions">
          <button class="btn btn--dark btn--lg" id="add-to-cart" ${disabled ? "disabled" : ""}>
            ${disabled ? "Out of Stock" : product.stock === "pre-order" ? "Pre-order Now" : "Add to Cart"}
          </button>
          <button class="btn btn--outline btn--lg" id="buy-now" ${disabled ? "disabled" : ""}>
            Buy Now
          </button>
        </div>

        ${
          product.description
            ? `<p class="pd-desc">${product.description}</p>`
            : `<p class="pd-desc">Genuine product with official warranty support. Delivered across Bangladesh — cash on delivery or bKash.</p>`
        }
      </div>
    </div>

    <div class="container pd-specs">
      <h2 class="pd-section-title">Specifications</h2>
      <div class="pd-spec-table">${specsHtml(product)}</div>
    </div>

    <section class="section section--gray">
      <div class="section__head">
        <h2 class="section__title">You May Also Like</h2>
        <a class="section__link" href="/shop.html">Shop All</a>
      </div>
      <div class="section__inner">
        <div class="p-rail" id="related-rail">
          <div class="p-skeleton"></div>
          <div class="p-skeleton"></div>
          <div class="p-skeleton"></div>
        </div>
      </div>
    </section>`;

  // -- Colour picker --------------------------------------------------
  const colourButtons = root.querySelectorAll<HTMLButtonElement>(".pd-colour");
  colourButtons.forEach((btn) =>
    btn.addEventListener("click", () => {
      colourButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      selectedColour = btn.dataset.colour;
      const label = document.getElementById("colour-label");
      if (label) label.textContent = selectedColour ?? "Choose one";
    }),
  );

  // -- Quantity stepper ------------------------------------------------
  const qtyInput = document.getElementById("qty-input") as HTMLInputElement | null;
  document.getElementById("qty-minus")?.addEventListener("click", () => {
    qty = Math.max(1, qty - 1);
    if (qtyInput) qtyInput.value = String(qty);
  });
  document.getElementById("qty-plus")?.addEventListener("click", () => {
    qty = Math.min(50, qty + 1);
    if (qtyInput) qtyInput.value = String(qty);
  });

  // -- Gallery thumb click --------------------------------------------
  root.querySelectorAll<HTMLButtonElement>(".pd-thumb").forEach((thumb) =>
    thumb.addEventListener("click", () => {
      root.querySelectorAll(".pd-thumb").forEach((t) => t.classList.remove("is-active"));
      thumb.classList.add("is-active");
      const main = document.getElementById("gallery-main");
      const src = thumb.dataset.src;
      const rotate = thumb.dataset.rotate;
      if (main && src) {
        main.innerHTML = `<img src="${src}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;" />`;
      } else if (main && rotate !== undefined) {
        const emoji = main.querySelector<HTMLElement>(".pd-gallery__emoji");
        if (emoji) emoji.style.transform = `rotate(${rotate})`;
      }
    }),
  );

  // -- Add to cart / Buy Now --------------------------------------------
  const doAdd = (): boolean => {
    if (disabled) return false;
    if (product.colours?.length && !selectedColour) {
      toast("Please choose a colour first", "error");
      return false;
    }
    cart.add(product, qty, selectedColour);
    toast(`Added to cart — ${product.name}`);
    return true;
  };

  document.getElementById("add-to-cart")?.addEventListener("click", doAdd);
  document.getElementById("buy-now")?.addEventListener("click", () => {
    if (doAdd()) window.location.href = "/checkout.html";
  });

  // -- Wishlist button ---------------------------------------------------
  const wishlistBtn = document.createElement("button");
  wishlistBtn.type = "button";
  wishlistBtn.className = "btn btn--outline btn--lg wishlist-add";
  wishlistBtn.dataset.productId = product.id;
  wishlistBtn.innerHTML = wishlist.has(product.id) ? "<span>♥ Added</span>" : "<span>♥ Wishlist</span>";
  wishlistBtn.style.marginLeft = "10px";
  wishlistBtn.title = "Add to wishlist";

  const addToCartBtn = document.getElementById("add-to-cart");
  addToCartBtn?.parentElement?.appendChild(wishlistBtn);
}
