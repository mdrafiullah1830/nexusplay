// ============================================================
// NEXUSPLAY — Header mini-cart drawer
// Slides in from the right; shares state with the cart service.
// ============================================================
import { cart, formatBDT, FREE_DELIVERY_THRESHOLD } from "../services/cart";
import { t } from "../services/i18n";

const EMOJI: Record<string, string> = {
  controllers: "🎮",
  keyboards: "⌨️",
  mice: "🖱️",
  other: "🔌",
};

let root: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let body: HTMLElement | null = null;
let foot: HTMLElement | null = null;
let lastFocus: HTMLElement | null = null;
let created = false;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[ch];
  });
}

function isOpen(): boolean {
  return !!root?.classList.contains("is-open");
}

function render(): void {
  if (!body || !foot) return;

  const title = document.getElementById("minicart-title");
  if (title) title.textContent = t("cart.title");

  const closeButton = root?.querySelector<HTMLElement>(".minicart__close");
  closeButton?.setAttribute("aria-label", t("cart.close"));

  const lines = cart.all();

  if (lines.length === 0) {
    body.innerHTML = `
      <div class="minicart__empty">
        <span class="minicart__empty-icon">🛒</span>
        <h3>${t("cart.empty")}</h3>
        <p>${t("cart.emptyText")}</p>
        <a class="btn btn--dark" href="/shop.html">${t("cart.shop")}</a>
      </div>`;
    foot.innerHTML = "";
    return;
  }

  const subtotal = cart.subtotal();
  const delivery = cart.deliveryFee(subtotal);
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const progress = Math.min(100, Math.round((subtotal / FREE_DELIVERY_THRESHOLD) * 100));

  body.innerHTML = `
    <div class="minicart__progress">
      <div class="minicart__progress-text">
        ${remaining > 0 ? t("cart.addMore", { amount: formatBDT(remaining) }) : `✓ ${t("cart.unlocked")}`}
      </div>
      <div class="minicart__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"
           aria-valuenow="${progress}" aria-label="${t("cart.delivery")}">
        <span style="width:${progress}%"></span>
      </div>
    </div>
    ${lines
      .map(
        (line) => `
      <div class="minicart__line" data-line data-id="${escapeHtml(line.id)}" data-colour="${escapeHtml(line.colour ?? "")}">
        <span class="minicart__thumb">${EMOJI[line.category] ?? "🎮"}</span>
        <div class="minicart__info">
          <div class="minicart__brand">${escapeHtml(line.brand)}</div>
          <div class="minicart__name">${escapeHtml(line.name)}</div>
          ${line.colour ? `<div class="minicart__meta">${escapeHtml(line.colour)}</div>` : ""}
          <div class="minicart__price">${formatBDT(line.price * line.qty)}</div>
        </div>
        <div class="minicart__end">
          <div class="minicart__qty">
            <button type="button" data-action="minus" aria-label="${t("cart.decrease")}">−</button>
            <span aria-label="${t("cart.qty")}">${line.qty}</span>
            <button type="button" data-action="plus" aria-label="${t("cart.increase")}">+</button>
          </div>
          <button type="button" class="minicart__remove" data-action="remove">${t("cart.remove")}</button>
        </div>
      </div>`,
      )
      .join("")}`;

  foot.innerHTML = `
    <div class="minicart__row">
      <span>${t("cart.subtotal")}</span>
      <span>${formatBDT(subtotal)}</span>
    </div>
    <div class="minicart__row">
      <span>${t("cart.delivery")}</span>
      <span>${delivery === 0 ? t("cart.free") : formatBDT(delivery)}</span>
    </div>
    <div class="minicart__row minicart__row--total">
      <span>${t("cart.total")}</span>
      <span>${formatBDT(subtotal + delivery)}</span>
    </div>
    <a class="btn btn--dark btn--block" href="/checkout.html">${t("cart.checkout")}</a>
    <a class="btn btn--outline btn--block" href="/cart.html">${t("cart.viewcart")}</a>`;
}

export function openMiniCart(): void {
  ensureDrawer();
  if (!root || !panel) return;

  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  render();
  root.classList.add("is-open");
  root.removeAttribute("aria-hidden");
  document.body.classList.add("minicart-open");

  panel.querySelector<HTMLElement>(".minicart__close")?.focus();
}

export function closeMiniCart(): void {
  if (!root) return;
  root.classList.remove("is-open");
  root.setAttribute("aria-hidden", "true");
  document.body.classList.remove("minicart-open");
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}

function onCartChange(): void {
  if (isOpen()) render();
}

function bindOnce(): void {
  if (created) return;
  created = true;

  document.addEventListener("keydown", (event) => {
    if (!isOpen() || !panel) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeMiniCart();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ).filter((el) => el.offsetParent !== null);

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  cart.onChange(onCartChange);
}

function ensureDrawer(): void {
  bindOnce();
  if (root) return;

  root = document.createElement("div");
  root.className = "minicart";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="minicart__backdrop" data-close></div>
    <aside class="minicart__panel" role="dialog" aria-modal="true" aria-labelledby="minicart-title">
      <header class="minicart__head">
        <h2 id="minicart-title">${t("cart.title")}</h2>
        <button class="minicart__close" type="button" data-close aria-label="${t("cart.close")}">✕</button>
      </header>
      <div class="minicart__body"></div>
      <footer class="minicart__foot"></footer>
    </aside>`;

  document.body.appendChild(root);
  panel = root.querySelector<HTMLElement>(".minicart__panel");
  body = root.querySelector<HTMLElement>(".minicart__body");
  foot = root.querySelector<HTMLElement>(".minicart__foot");

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    if (target.closest("[data-close]")) {
      closeMiniCart();
      return;
    }

    const action = target.closest<HTMLElement>("[data-action]");
    if (!action) return;

    const line = action.closest<HTMLElement>("[data-line]");
    if (!line) return;

    const id = line.dataset.id ?? "";
    const colour = line.dataset.colour || undefined;
    const current = cart.all().find((l) => l.id === id && l.colour === colour);
    if (!current) return;

    if (action.dataset.action === "plus") cart.setQty(id, colour, current.qty + 1);
    if (action.dataset.action === "minus") cart.setQty(id, colour, current.qty - 1);
    if (action.dataset.action === "remove") cart.remove(id, colour);
  });
}

export function initMiniCart(): void {
  bindOnce();
}
