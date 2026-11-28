// ============================================================
// NEXUSPLAY — Order tracking page
// ============================================================
import { api, ApiError } from "../services/api";
import { formatBDT } from "../services/cart";
import type { Order } from "../types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

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
          <strong>${escapeHtml(STATUS_LABEL[t.status] ?? t.status)}</strong>
          ${t.note ? `<span>${escapeHtml(t.note ?? "")}</span>` : ""}
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
          <strong>${escapeHtml(STATUS_LABEL[t.status] ?? t.status)}</strong>
          ${t.note ? `<span>${escapeHtml(t.note ?? "")}</span>` : ""}
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
          <div class="track-result__no">${escapeHtml(order.orderNo)}</div>
          <div class="track-result__date">${new Date(order.createdAt).toLocaleString()}</div>
        </div>
        <span class="stock-badge ${
          order.status === "delivered"
            ? "stock-badge--in"
            : order.status === "cancelled"
              ? "stock-badge--out"
              : "stock-badge--pre"
        }">${escapeHtml(STATUS_LABEL[order.status] ?? order.status)}</span>
      </div>

      ${timelineHtml(order)}

      <div class="track-result__items">
        ${order.items
          .map(
            (i) => `
          <div class="mini-line">
            <span>${escapeHtml(i.name)}${i.colour ? ` (${escapeHtml(i.colour ?? "")})` : ""} × ${i.qty}</span>
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
        <div><strong>Name:</strong> ${escapeHtml(order.customer.name)}</div>
        <div><strong>Phone:</strong> ${escapeHtml(order.customer.phone)}</div>
        <div><strong>Address:</strong> ${escapeHtml(order.customer.address)}${
          order.customer.city ? `, ${escapeHtml(order.customer.city ?? "")}` : ""
        }</div>
        <div><strong>Payment:</strong> ${
          order.paymentMethod === "bkash"
            ? `bKash${order.bkashTrxId ? ` · Trx ${escapeHtml(order.bkashTrxId ?? "")}` : ""}`
            : "Cash on Delivery"
        }</div>
      </div>
    </div>`;
}

export function initTrackPage(): void {
  const form = document.getElementById("track-form") as HTMLFormElement | null;
  const result = document.getElementById("track-result");
  if (!form || !result) return;
  const orderNoInput = form.querySelector<HTMLInputElement>("#track-no")!;
  const phoneInput = form.querySelector<HTMLInputElement>("#track-phone")!;
  orderNoInput.value = new URLSearchParams(window.location.search).get("orderNo") ?? "";
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function stop(): void {
    generation++;
    if (timer !== undefined) clearTimeout(timer);
  }
  window.addEventListener("pagehide", stop);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    stop();
    const request = generation;
    const phone = phoneInput.value.replace(/\s|-/g, "");
    const orderNo = orderNoInput.value.trim();
    if (!orderNo || !/^01[3-9]\d{8}$/.test(phone)) {
      result.textContent = "Enter your order number and full Bangladeshi phone number.";
      return;
    }
    const path = "/orders/track?orderNo=" + encodeURIComponent(orderNo) + "&phone=" + encodeURIComponent(phone);
    result.textContent = "Searching for your order…";
    async function refresh(initial: boolean): Promise<void> {
      if (request !== generation || !result) return;
      try {
        const order = await api.get<Order>(path);
        if (request !== generation) return;
        result.innerHTML = orderCard(order);
        if (order.status === "delivered" || order.status === "cancelled") return;
      } catch (err) {
        if (request !== generation) return;
        if (initial || (err instanceof ApiError && [400, 401, 403, 404].includes(err.status))) {
          result.textContent = err instanceof ApiError ? err.message : "Unable to load your order. Please retry.";
          return;
        }
      }
      if (request === generation) timer = setTimeout(() => void refresh(false), 10000);
    }
    await refresh(true);
  });
}
