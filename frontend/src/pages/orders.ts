import { api } from "../services/api";
import { auth } from "../services/auth";
import { formatBDT } from "../services/cart";
import type { Order, PagedResult } from "../types";

export function initOrdersPage(): void {
  const root = document.getElementById("orders-list");
  if (!root) return;
  if (!auth.isLoggedIn() || auth.isExpired()) {
    const link = document.createElement("a");
    link.href = "/login.html";
    link.textContent = "Sign in to view your orders";
    root.replaceChildren(link);
    return;
  }

  async function load(page: number): Promise<void> {
    if (!root) return;
    root.textContent = "Loading orders…";
    try {
      const result = await api.get<PagedResult<Order>>("/orders/my?page=" + page, true);
      root.replaceChildren();
      if (!result.items.length) root.textContent = "No orders found.";
      for (const order of result.items) {
        const card = document.createElement("article");
        card.className = "checkout-card";
        const heading = document.createElement("h2");
        heading.textContent = order.orderNo;
        const details = document.createElement("p");
        details.textContent = order.status + " · " + formatBDT(order.total);
        const link = document.createElement("a");
        link.href = "/track.html?orderNo=" + encodeURIComponent(order.orderNo);
        link.textContent = "Track order";
        card.append(heading, details, link);
        root.append(card);
      }
      const controls = document.createElement("div");
      for (const [label, target, disabled] of [
        ["Previous", page - 1, page <= 1],
        ["Next", page + 1, page * result.pageSize >= result.total],
      ] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn--outline";
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener("click", () => void load(target));
        controls.append(button);
      }
      root.append(controls);
    } catch {
      root.textContent = "Unable to load orders. Please sign in again or retry.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Retry";
      retry.addEventListener("click", () => void load(page));
      root.append(retry);
    }
  }
  void load(1);
}
