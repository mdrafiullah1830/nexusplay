// ============================================================
// NEXUSPLAY — Checkout page (COD + bKash)
// ============================================================
import { api, ApiError } from "../services/api";
import { cart, formatBDT } from "../services/cart";
import { auth } from "../services/auth";
import { toast } from "../services/toast";
import type { Order } from "../types";

const BKASH_NUMBER = "01782577251";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

function validatePhone(phone: string): boolean {
  return /^01[3-9]\d{8}$/.test(phone.replace(/\s|-/g, ""));
}

export function initCheckoutPage(): void {
  const root = document.getElementById("checkout-root") as HTMLElement | null;
  if (!root) return;
  const page: HTMLElement = root;

  const lines = cart.all();

  if (lines.length === 0) {
    root.innerHTML = `
      <div class="page-message">
        <span style="font-size:3.5rem">🧾</span>
        <h2>Nothing to checkout</h2>
        <p>Your cart is empty.</p>
        <a class="btn btn--dark" href="/shop.html">Shop Now</a>
      </div>`;
    return;
  }

  const user = auth.user();
  const subtotal = cart.subtotal();
  const delivery = cart.deliveryFee(subtotal);
  const total = subtotal + delivery;

  root.innerHTML = `
    <div class="container checkout-layout">
      <form id="checkout-form" class="checkout-form" novalidate>
        <h1 class="page-title">Checkout</h1>

        <section class="checkout-card">
          <h2>Contact Information</h2>
          <div class="form-grid">
            <label>Full Name *
              <input name="name" type="text" required value="${escapeHtml(user?.name ?? "")}" placeholder="Your name" />
            </label>
            <label>Phone *
              <input name="phone" type="tel" required value="${escapeHtml(user?.phone ?? "")}"
                     placeholder="01XXXXXXXXX" />
            </label>
            <label class="span-2">Email
              <input name="email" type="email" value="${escapeHtml(user?.email ?? "")}" placeholder="you@example.com" />
            </label>
          </div>
        </section>

        <section class="checkout-card">
          <h2>Delivery Address</h2>
          <div class="form-grid">
            <label class="span-2">Street Address *
              <input name="address" type="text" required placeholder="House, road, area" />
            </label>
            <label>City
              <input name="city" type="text" placeholder="Dhaka" />
            </label>
            <label>Area / Thana
              <input name="area" type="text" placeholder="Dhanmondi" />
            </label>
            <label class="span-2">Order Note
              <textarea name="note" rows="2" placeholder="Delivery instructions (optional)"></textarea>
            </label>
          </div>
        </section>

        <section class="checkout-card">
          <h2>Payment Method</h2>

          <label class="pay-option">
            <input type="radio" name="payment" value="cod" checked />
            <div>
              <strong>💵 Cash on Delivery</strong>
              <span>Pay when your order arrives. BDT ${delivery === 0 ? "0" : delivery + " delivery"}</span>
            </div>
          </label>

          <label class="pay-option">
            <input type="radio" name="payment" value="bkash" />
            <div>
              <strong>📱 bKash</strong>
              <span>Send money first, then submit the transaction ID</span>
            </div>
          </label>

          <div class="bkash-panel" id="bkash-panel" hidden>
            <ol class="bkash-steps">
              <li>Open bKash → <strong>Send Money</strong></li>
              <li>Send <strong>${formatBDT(total)}</strong> to <strong>${BKASH_NUMBER}</strong></li>
              <li>Copy the TrxID and paste it below</li>
            </ol>
            <label>bKash TrxID *
              <input name="bkashTrxId" type="text" placeholder="e.g. 9H7AB12CD34EF" />
            </label>
          </div>
        </section>

        <div class="form-error" id="form-error" hidden></div>

        <button type="submit" class="btn btn--dark btn--lg btn--block" id="place-btn">
          Place Order · ${formatBDT(total)}
        </button>
      </form>

      <aside class="cart-summary checkout-summary">
        <h2>Order Summary</h2>
        ${lines
          .map(
            (l) => `
          <div class="mini-line">
            <span>${escapeHtml(l.name)}${l.colour ? ` (${escapeHtml(l.colour)})` : ""} × ${l.qty}</span>
            <span>${formatBDT(l.price * l.qty)}</span>
          </div>`,
          )
          .join("")}
        <div class="summary-row"><span>Subtotal</span><span>${formatBDT(subtotal)}</span></div>
        <div class="summary-row"><span>Delivery</span><span>${delivery === 0 ? "FREE" : formatBDT(delivery)}</span></div>
        <div class="summary-row summary-row--total"><span>Total</span><span>${formatBDT(total)}</span></div>
      </aside>
    </div>`;

  // Toggle bKash panel
  const bkashPanel = document.getElementById("bkash-panel") as HTMLElement;
  root.querySelectorAll<HTMLInputElement>("input[name='payment']").forEach((radio) =>
    radio.addEventListener("change", () => {
      const isBkash = radio.value === "bkash" && radio.checked;
      bkashPanel.hidden = !isBkash;
    }),
  );

  // Submit
  const form = document.getElementById("checkout-form") as HTMLFormElement;
  const errorBox = document.getElementById("form-error") as HTMLElement;
  const placeBtn = document.getElementById("place-btn") as HTMLButtonElement;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (placeBtn.disabled) return;
    errorBox.hidden = true;

    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const address = String(data.get("address") ?? "").trim();
    const payment = String(data.get("payment") ?? "cod");
    const trx = String(data.get("bkashTrxId") ?? "").trim();

    const fail = (msg: string): void => {
      errorBox.textContent = msg;
      errorBox.hidden = false;
      toast(msg, "error");
    };

    if (!name || !phone || !address) return fail("Name, phone and address are required.");
    if (!validatePhone(phone))
      return fail("Please enter a valid Bangladeshi phone number (01XXXXXXXXX).");
    if (payment === "bkash" && !trx) return fail("bKash TrxID is required for bKash payment.");

    placeBtn.disabled = true;
    placeBtn.textContent = "Placing order…";

    try {
      if (payment !== "cod" && payment !== "bkash") throw new Error("Unsupported payment method");
      const order = await api.post<Order>("/orders", {
        customer: {
          name,
          phone,
          email: String(data.get("email") ?? "").trim() || undefined,
          address,
          city: String(data.get("city") ?? "").trim() || undefined,
          area: String(data.get("area") ?? "").trim() || undefined,
          note: String(data.get("note") ?? "").trim() || undefined,
        },
        items: lines.map((l) => ({
          productId: l.id,
          qty: l.qty,
          colour: l.colour,
        })),
        paymentMethod: payment,
        bkashTrxId: payment === "bkash" ? trx : undefined,
      }, true);

      if (!order?.orderNo) throw new Error("Order response missing order number");
      cart.clear();
      renderSuccess(order);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      fail(msg);
      placeBtn.disabled = false;
      placeBtn.textContent = `Place Order · ${formatBDT(total)}`;
    }
  });

  function renderSuccess(order: Order): void {
    page.innerHTML = `
      <div class="container">
        <div class="order-success">
          <div class="order-success__icon">✓</div>
          <h1>Order Received!</h1>
          <p>Thank you, ${escapeHtml(order.customer.name)}. We've received your order.</p>

          <div class="order-success__no">
            <span>Order Number</span>
            <strong>${escapeHtml(order.orderNo)}</strong>
          </div>

          ${
            order.paymentMethod === "bkash"
              ? `<div class="order-success__note">
                   bKash payment <strong>${escapeHtml(order.bkashTrxId ?? "")}</strong> is pending verification.
                   We'll confirm via phone shortly.
                 </div>`
              : `<div class="order-success__note">Payment: <strong>Cash on Delivery</strong></div>`
          }

          <div class="order-success__total">Total: <strong>${formatBDT(order.total)}</strong></div>

          <div class="order-success__note order-success__note--info">
            Keep your order number for tracking.
          </div>

          <div class="order-success__actions">
            <a class="btn btn--dark" href="/track.html?orderNo=${order.orderNo}">Track This Order</a>
            <a class="btn btn--outline" href="/shop.html">Continue Shopping</a>
          </div>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}
