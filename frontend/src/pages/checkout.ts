// ============================================================
// NEXUSPLAY — Checkout page (COD, bKash + SSLCOMMERZ)
// ============================================================
import { api, ApiError } from "../services/api";
import { cart, formatBDT } from "../services/cart";
import { auth } from "../services/auth";
import { toast } from "../services/toast";
import type { Order } from "../types";

const BKASH_NUMBER = "01782577251";

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
              <input name="name" type="text" required value="${user?.name ?? ""}" placeholder="Your name" />
            </label>
            <label>Phone *
              <input name="phone" type="tel" required value="${user?.phone ?? ""}"
                     placeholder="01XXXXXXXXX" />
            </label>
            <label class="span-2">Email
              <input name="email" type="email" maxlength="50" value="${user?.email ?? ""}" placeholder="you@example.com" />
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

          <label class="pay-option">
            <input type="radio" name="payment" value="card" />
            <div>
              <strong>💳 Card / Gateway</strong>
              <span>Secure checkout using SSLCOMMERZ cards, banks and mobile banking</span>
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
            (line) => `
          <div class="mini-line">
            <span>${line.name}${line.colour ? ` (${line.colour})` : ""} × ${line.qty}</span>
            <span>${formatBDT(line.price * line.qty)}</span>
          </div>`,
          )
          .join("")}
        <div class="summary-row"><span>Subtotal</span><span>${formatBDT(subtotal)}</span></div>
        <div class="summary-row"><span>Delivery</span><span>${delivery === 0 ? "FREE" : formatBDT(delivery)}</span></div>
        <div class="summary-row summary-row--total"><span>Total</span><span>${formatBDT(total)}</span></div>
      </aside>
    </div>`;

  const bkashPanel = document.getElementById("bkash-panel") as HTMLElement;
  const emailInput = root.querySelector<HTMLInputElement>("input[name='email']")!;
  root.querySelectorAll<HTMLInputElement>("input[name='payment']").forEach((radio) =>
    radio.addEventListener("change", () => {
      bkashPanel.hidden = !(radio.value === "bkash" && radio.checked);
      emailInput.required = radio.value === "card" && radio.checked;
    }),
  );

  const form = document.getElementById("checkout-form") as HTMLFormElement;
  const errorBox = document.getElementById("form-error") as HTMLElement;
  const placeBtn = document.getElementById("place-btn") as HTMLButtonElement;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;

    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const address = String(data.get("address") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const payment = String(data.get("payment") ?? "cod");
    const trx = String(data.get("bkashTrxId") ?? "").trim();

    const fail = (message: string): void => {
      errorBox.textContent = message;
      errorBox.hidden = false;
      toast(message, "error");
    };

    if (!name || !phone || !address)
      return fail("Name, phone and address are required.");
    if (!validatePhone(phone))
      return fail("Please enter a valid Bangladeshi phone number (01XXXXXXXXX).");
    if (payment === "bkash" && !trx)
      return fail("bKash TrxID is required for bKash payment.");
    if (payment === "card" &&
        (!email || email.length > 50 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)))
      return fail("Enter a valid email address (maximum 50 characters) for card payment.");

    placeBtn.disabled = true;
    placeBtn.textContent = "Placing order…";

    const customer = {
      name,
      phone,
      email: email || undefined,
      address,
      city: String(data.get("city") ?? "").trim() || undefined,
      area: String(data.get("area") ?? "").trim() || undefined,
      note: String(data.get("note") ?? "").trim() || undefined,
    };
    const items = lines.map((line) => ({
      productId: line.id,
      qty: line.qty,
      colour: line.colour,
    }));

    try {
      if (payment === "card") {
        const result = await api.post<{
          orderNo: string;
          gatewayUrl?: string;
          sessionId?: string;
          total: number;
        }>("/payments/initiate", {
          customer,
          items,
          paymentMethod: "card",
          paymentGateway: "sslcommerz",
        }, true);

        if (!result.gatewayUrl)
          throw new Error("The payment gateway did not return a checkout link.");

        cart.clear();
        window.location.href = result.gatewayUrl;
        return;
      }

      // COD and manual bKash payments are normal orders; they must not be
      // sent to the SSLCOMMERZ gateway initiation endpoint.
      const order = await api.post<Order>("/orders", {
        customer,
        items,
        paymentMethod: payment,
        bkashTrxId: payment === "bkash" ? trx : undefined,
      }, true);

      cart.clear();
      renderSuccess(order);
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      fail(message);
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
          <p>Thank you, ${order.customer.name}. We've received your order.</p>

          <div class="order-success__no">
            <span>Order Number</span>
            <strong>${order.orderNo}</strong>
          </div>

          ${
            order.paymentMethod === "bkash"
              ? `<div class="order-success__note">
                   bKash payment <strong>${order.bkashTrxId}</strong> is pending verification.
                   We'll confirm via phone shortly.
                 </div>`
              : `<div class="order-success__note">Payment: <strong>Cash on Delivery</strong></div>`
          }

          <div class="order-success__total">Total: <strong>${formatBDT(order.total)}</strong></div>

          <div class="order-success__note order-success__note--info">
            Your order updates will use the contact details provided at checkout.
          </div>

          <div class="order-success__actions">
            <a class="btn btn--dark" href="/track.html?orderNo=${encodeURIComponent(order.orderNo)}">Track This Order</a>
            <a class="btn btn--outline" href="/shop.html">Continue Shopping</a>
          </div>
        </div>
      </div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}