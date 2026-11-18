// ============================================================
// NEXUSPLAY — Order tracking page
// ============================================================
import { api, ApiError } from "../services/api";
import { formatBDT } from "../services/cart";
import type { Order } from "../types";

const STEPS = [
  { key: "pending", label: "Order Placed" },
  { key: "awaiting-verification", label: "Payment Check" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Order Placed",
  "awaiting-verification": "Awaiting Payment Verification",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function timelineHtml(order: Order): string {
  if (order.status === "cancelled") {
    return `<div class="timeline timeline--cancelled">
      ${order.tracking
        .map(
          (t) => `
        <div class="timeline__event">
          <strong>${STATUS_LABEL[t.status] ?? t.status}</strong>
          ${t.note ? `<span>${t.note}</span>` : ""}
          <time>${new Date(t.at).toLocaleString()}</time>
        </div>`,
        )
        .join("")}
    </div>`;
  }

  const currentIdx = STEPS.findIndex((s) => s.key === order.status);
  const effectiveIdx = order.status === "awaiting-verification" ? 1 : currentIdx;

  return `
    <div class="timeline">
      ${STEPS.map(
        (s, i) => `
        <div class="timeline__step ${i <= effectiveIdx ? "is-done" : ""}">
          <div class="timeline__dot">${i <= effectiveIdx ? "✓" : i + 1}</div>
          <div class="timeline__label">${s.label}</div>
        </div>`,
      ).join("")}
    </div>
    <div class="timeline__events">
      ${order.tracking
        .slice()
        .reverse()
        .map(
          (t) => `
        <div class="timeline__event">
          <strong>${STATUS_LABEL[t.status] ?? t.status}</strong>
          ${t.note ? `<span>${t.note}</span>` : ""}
          <time>${new Date(t.at).toLocaleString()}</time>
        </div>`,
        )
        .join("")}
    </div>`;
}

function orderCard(order: Order): string {
  return `
    <div class="track-result">
      <div class="track-result__head">
        <div>
          <div class="track-result__no">${order.orderNo}</div>
          <div class="track-result__date">${new Date(order.createdAt).toLocaleString()}</div>
        </div>
        <span class="stock-badge ${
          order.status === "delivered"
            ? "stock-badge--in"
            : order.status === "cancelled"
              ? "stock-badge--out"
              : "stock-badge--pre"
        }">${STATUS_LABEL[order.status] ?? order.status}</span>
      </div>

      ${timelineHtml(order)}

      <div class="track-result__items">
        ${order.items
          .map(
            (i) => `
          <div class="mini-line">
            <span>${i.name}${i.colour ? ` (${i.colour})` : ""} × ${i.qty}</span>
            <span>${formatBDT(i.price * i.qty)}</span>
          </div>`,
          )
          .join("")}
        <div class="summary-row"><span>Delivery</span><span>${
          order.deliveryFee === 0 ? "FREE" : formatBDT(order.deliveryFee)
        }</span></div>
        <div class="summary-row summary-row--total"><span>Total</span><span>${formatBDT(
          order.total,
        )}</span></div>
      </div>

      <div class="track-result__meta">
        <div><strong>Name:</strong> ${order.customer.name}</div>
        <div><strong>Phone:</strong> ${order.customer.phone}</div>
        <div><strong>Address:</strong> ${order.customer.address}${
          order.customer.city ? `, ${order.customer.city}` : ""
        }</div>
        <div><strong>Payment:</strong> ${
          order.paymentMethod === "bkash"
            ? `bKash${order.bkashTrxId ? ` · Trx ${order.bkashTrxId}` : ""}`
            : "Cash on Delivery"
        }</div>
      </div>
    </div>`;
}

export function initTrackPage(): void {
  const form = document.getElementById("track-form") as HTMLFormElement | null;
  const result = document.getElementById("track-result")!;
  if (!form || !result) return;

  const orderNoInput = form.querySelector<HTMLInputElement>("#track-no")!;
  const phoneInput = form.querySelector<HTMLInputElement>("#track-phone")!;

  // Prefill from ?orderNo=
  const params = new URLSearchParams(window.location.search);
  if (params.get("orderNo")) orderNoInput.value = params.get("orderNo")!;

  // Current order being tracked
  let currentOrder: Order | null = null;
  let eventSource: EventSource | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  function render(order: Order): void {
    result.innerHTML = orderCard(order);
    currentOrder = order;
  }

  function mapStatusClass(status: string): string {
    switch (status) {
      case "delivered": return "in";
      case "cancelled": return "out";
      case "awaiting-verification": return "pre";
      default: return "pre";
    }
  }

  function startPolling(): void {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        const order = await api.get<Order>(
          `/orders/track?orderNo=${encodeURIComponent(orderNoInput.value.trim())}&phone=${encodeURIComponent(phoneInput.value.trim())}`,
        );
        render(order);
      } catch { /* silently retry */ }
    }, 5000);
  }

  function initSSE(orderNo: string): void {
    if (eventSource) { eventSource.close(); eventSource = null; }
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }

    eventSource = new EventSource(`/api/orders/track/stream/${encodeURIComponent(orderNo)}`);

    eventSource.onopen = () => { result.querySelector(".shop-loading")?.remove(); };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (currentOrder) {
          const statusEl = result.querySelector(".stock-badge") as HTMLElement | null;
          if (statusEl && STATUS_LABEL[data.status]) {
            
            statusEl.className = `stock-badge stock-badge--${mapStatusClass(data.status)} animate-status`;
            statusEl.style.transition = "all 0.3s ease";
            void statusEl.offsetWidth;
          }
        }
      } catch {
        if (eventSource) { eventSource.close(); eventSource = null; }
        startPolling();
      }
    };

    eventSource.addEventListener("order-status", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (currentOrder && STATUS_LABEL[data.status]) {
          const statusEl = result.querySelector(".stock-badge") as HTMLElement | null;
          if (statusEl) {
            statusEl.textContent = STATUS_LABEL[data.status];
            statusEl.className = `stock-badge stock-badge--${mapStatusClass(data.status)} animate-status`;
            statusEl.style.transition = "all 0.3s ease";
            void statusEl.offsetWidth;
          }
        }
      } catch {}
    });

    eventSource.onerror = () => {
      if (eventSource) { eventSource.close(); eventSource = null; }
      startPolling();
    };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    result.innerHTML = `<div class="shop-loading">Searching for your order…</div>`;

    try {
      const order = await api.get<Order>(
        `/orders/track?orderNo=${encodeURIComponent(orderNoInput.value.trim())}&phone=${encodeURIComponent(phoneInput.value.trim())}`,
      );
      render(order);
      initSSE(order.orderNo);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not reach the server.";
      result.innerHTML = `
        <div class="track-empty">
          <span style="font-size:2.5rem">📦</span>
          <h3>${msg}</h3>
          <p>Check your order number (starts with <strong>NP</strong>) and the phone number you ordered with.</p>
        </div>`;
    }
  });
}
