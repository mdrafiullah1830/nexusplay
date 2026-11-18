// ============================================================
// NEXUSPLAY — Cart page
// ============================================================
import { cart, formatBDT } from "../services/cart";

const EMOJI: Record<string, string> = {
  controllers: "🎮",
  keyboards: "⌨️",
  mice: "🖱️",
  other: "🔌",
};

export function initCartPage(): void {
  const root = document.getElementById("cart-root");
  if (!root) return;

  const render = (): void => {
    const lines = cart.all();

    if (lines.length === 0) {
      root.innerHTML = `
        <div class="page-message">
          <span style="font-size:3.5rem">🛒</span>
          <h2>Your cart is empty</h2>
          <p>Looks like you haven't added anything yet.</p>
          <a class="btn btn--dark" href="/shop.html">Shop Controllers</a>
        </div>`;
      return;
    }

    const subtotal = cart.subtotal();
    const delivery = cart.deliveryFee(subtotal);
    const remaining = Math.max(0, 5000 - subtotal);

    root.innerHTML = `
      <div class="container cart-layout">
        <div class="cart-lines">
          <h1 class="page-title">Cart <span class="muted">(${cart.count()} items)</span></h1>
          ${lines
            .map(
              (l) => `
            <div class="cart-line" data-id="${l.id}" data-colour="${l.colour ?? ""}">
              <div class="cart-line__img">${EMOJI[l.category] ?? "🎮"}</div>
              <div class="cart-line__info">
                <div class="cart-line__brand">${l.brand}</div>
                <div class="cart-line__name">${l.name}</div>
                ${l.colour ? `<div class="cart-line__meta">Colour: ${l.colour}</div>` : ""}
                <div class="cart-line__price">
                  <strong>${formatBDT(l.price)}</strong>
                  ${l.oldPrice > l.price ? `<s>${formatBDT(l.oldPrice)}</s>` : ""}
                </div>
              </div>
              <div class="cart-line__controls">
                <div class="qty-stepper">
                  <button data-action="minus">−</button>
                  <input type="number" value="${l.qty}" readonly />
                  <button data-action="plus">+</button>
                </div>
                <button class="cart-line__remove" data-action="remove">Remove</button>
              </div>
            </div>`,
            )
            .join("")}
        </div>

        <aside class="cart-summary">
          <h2>Summary</h2>
          <div class="summary-row"><span>Subtotal</span><span>${formatBDT(subtotal)}</span></div>
          <div class="summary-row">
            <span>Delivery</span>
            <span>${delivery === 0 ? "FREE" : formatBDT(delivery)}</span>
          </div>
          ${
            remaining > 0
              ? `<div class="summary-note">Add ${formatBDT(remaining)} more for free delivery</div>`
              : `<div class="summary-note summary-note--good">✓ You've unlocked free delivery</div>`
          }
          <div class="summary-row summary-row--total"><span>Total</span><span>${formatBDT(subtotal + delivery)}</span></div>
          <a class="btn btn--dark btn--lg btn--block" href="/checkout.html">Proceed to Checkout</a>
          <a class="btn btn--outline btn--block" href="/shop.html">Continue Shopping</a>
        </aside>
      </div>`;
  };

  root.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const line = target.closest<HTMLElement>(".cart-line");
    if (!line) return;

    const id = line.dataset.id ?? "";
    const colour = line.dataset.colour || undefined;
    const current = cart.all().find((l) => l.id === id && l.colour === colour);
    if (!current) return;

    const action = (target.closest("[data-action]") as HTMLElement | null)?.dataset.action;
    if (action === "minus") cart.setQty(id, colour, current.qty - 1);
    if (action === "plus") cart.setQty(id, colour, current.qty + 1);
    if (action === "remove") {
      cart.remove(id, colour);
      return; // render() happens via cart.onChange below
    }
    render();
  });

  cart.onChange(render);
  render();
}
