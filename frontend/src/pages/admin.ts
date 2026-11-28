// ============================================================
// NEXUSPLAY — Admin dashboard (products CRUD + order management)
// ============================================================
import { api, ApiError } from "../services/api";
import { auth } from "../services/auth";
import { formatBDT } from "../services/cart";
import { toast } from "../services/toast";
import type { AdminStats, Order, PagedResult, Product } from "../types";
import { escapeHtml } from "../utils/html";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "awaiting-verification", label: "Awaiting Verification" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const EMPTY_PRODUCT: Product = {
  id: "",
  name: "",
  brand: "GameSir",
  category: "controllers",
  price: 0,
  oldPrice: 0,
  compatibility: [],
  stock: "in-stock",
  rating: 4.5,
};

export function initAdminPage(): void {
  const root = document.getElementById("admin-root");
  if (!root) return;

  // -- Guard ----------------------------------------------------
  if (!auth.isLoggedIn() || auth.isExpired()) {
    window.location.href = "/login.html?redirect=/admin.html";
    return;
  }
  if (!auth.isAdmin()) {
    root.innerHTML = `
      <div class="page-message">
        <span style="font-size:3rem">🔒</span>
        <h2>Admin access required</h2>
        <a class="btn btn--dark" href="/">Back to Home</a>
      </div>`;
    return;
  }

  let currentTab: "products" | "orders" = "products";
  let orderStatus = "";
  let orderSearch = "";

  root.innerHTML = `
    <div class="container admin">
      <div class="admin__head">
        <h1 class="page-title">Admin Dashboard</h1>
        <span class="admin__hello">Logged in as ${escapeHtml(auth.user()?.email ?? "")}</span>
      </div>

      <div class="admin__stats" id="admin-stats"></div>

      <div class="admin__tabs">
        <button class="admin__tab is-active" data-tab="products">Products</button>
        <button class="admin__tab" data-tab="orders">Orders</button>
      </div>

      <div class="admin__toolbar" id="admin-toolbar"></div>
      <div id="admin-content"><div class="shop-loading">Loading…</div></div>
    </div>

    <div class="modal" id="product-modal" hidden>
      <div class="modal__box">
        <div class="modal__head">
          <h2 id="modal-title">Add Product</h2>
          <button class="modal__close" id="modal-close">✕</button>
        </div>
        <form id="product-form" class="modal__form">
          <input type="hidden" name="id" />
          <div class="form-grid">
            <label class="span-2">Name *
              <input name="name" required placeholder="GameSir G7 Pro" />
            </label>
            <label>Brand *
              <input name="brand" required list="brand-list" placeholder="GameSir" />
              <datalist id="brand-list">
                <option>GameSir</option><option>Flydigi</option>
                <option>8BitDo</option><option>EasySMX</option>
              </datalist>
            </label>
            <label>Category *
              <select name="category">
                <option value="controllers">Controllers</option>
                <option value="keyboards">Keyboards</option>
                <option value="mice">Mice</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>Price (BDT) *
              <input name="price" type="number" min="0" required />
            </label>
            <label>Old Price (BDT)
              <input name="oldPrice" type="number" min="0" />
            </label>
            <label>Stock Status
              <select name="stock">
                <option value="in-stock">In Stock</option>
                <option value="pre-order">Pre-order</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </label>
            <label>Advance (BDT)
              <input name="advance" type="number" min="0" placeholder="1000" />
            </label>
            <label>Rating
              <input name="rating" type="number" min="0" max="5" step="0.1" value="4.5" />
            </label>
            <label>Colours (comma separated)
              <input name="colours" placeholder="Black, White" />
            </label>
            <label class="span-2">Compatibility (comma separated)
              <input name="compatibility" placeholder="PC, Switch, Android, iOS" />
            </label>
            <label class="span-2">Connectivity
              <input name="connectivity" placeholder="2.4G, Bluetooth, USB wired" />
            </label>
            <label class="span-2">Product Images
              <input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp" />
              <small class="form-hint">JPG, PNG, WEBP — up to 5 images</small>
            </label>
          </div>
          <div class="form-error" id="product-form-error" hidden></div>
          <button type="submit" class="btn btn--dark btn--block">Save Product</button>
        </form>
      </div>
    </div>`;

  const content = document.getElementById("admin-content")!;
  const toolbar = document.getElementById("admin-toolbar")!;

  // -- Tabs -----------------------------------------------------
  root.querySelectorAll<HTMLButtonElement>(".admin__tab").forEach((tab) =>
    tab.addEventListener("click", () => {
      root
        .querySelectorAll(".admin__tab")
        .forEach((t) => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      currentTab = tab.dataset.tab as "products" | "orders";
      renderToolbar();
      void renderContent();
    }),
  );

  function renderToolbar(): void {
    if (currentTab === "products") {
      toolbar.innerHTML = `
        <input type="search" id="prod-search" class="filter-search" placeholder="Search products…" />
        <button class="btn btn--dark" id="add-product-btn">+ Add Product</button>`;
      document.getElementById("add-product-btn")?.addEventListener("click", () => openModal());
      (document.getElementById("prod-search") as HTMLInputElement).addEventListener(
        "input",
        debounce(() => void renderContent(), 300),
      );
    } else {
      toolbar.innerHTML = `
        <input type="search" id="order-search" class="filter-search" placeholder="Order no / phone / name…" />
        <select id="order-status-filter" class="filter-select">
          <option value="">All statuses</option>
          ${STATUS_OPTIONS.map((s) => `<option value="${s.value}">${s.label}</option>`).join("")}
        </select>`;
      (document.getElementById("order-search") as HTMLInputElement).addEventListener(
        "input",
        debounce((e: Event) => {
          orderSearch = (e.target as HTMLInputElement).value.trim();
          void renderContent();
        }, 350),
      );
      (document.getElementById("order-status-filter") as HTMLSelectElement).addEventListener(
        "change",
        (e) => {
          orderStatus = (e.target as HTMLSelectElement).value;
          void renderContent();
        },
      );
    }
  }

  // -- Content --------------------------------------------------
  async function renderContent(): Promise<void> {
    try {
      if (currentTab === "products") {
        const q = (document.getElementById("prod-search") as HTMLInputElement)?.value ?? "";
        const res = await api.get<PagedResult<Product>>(
          `/admin/products${q ? `?search=${encodeURIComponent(q)}` : ""}`,
          true,
        );
        renderProductsTable(res.items);
      } else {
        const params = new URLSearchParams({ pageSize: "50" });
        if (orderStatus) params.set("status", orderStatus);
        if (orderSearch) params.set("q", orderSearch);
        const res = await api.get<PagedResult<Order>>(`/admin/orders?${params}`, true);
        renderOrdersTable(res.items);
      }
    } catch (err) {
      content.innerHTML = `
        <div class="track-empty">
          <h3>${escapeHtml(err instanceof ApiError ? err.message : "Failed to load data")}</h3>
          <p>Is the backend running on port 5000?</p>
        </div>`;
    }
  }

  function renderProductsTable(items: Product[]): void {
    content.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Product</th><th>Brand</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${items
              .map(
                (p) => `
              <tr>
                <td>
                  <div class="admin-table__name">${escapeHtml(p.name)}</div>
                  <div class="admin-table__sub">${escapeHtml(p.compatibility?.join(", ") ?? "")}</div>
                </td>
                <td>${escapeHtml(p.brand)}</td>
                <td>
                  ${formatBDT(p.price)}
                  ${p.oldPrice > p.price ? `<s>${formatBDT(p.oldPrice)}</s>` : ""}
                </td>
                <td><span class="stock-badge ${
                  p.stock === "in-stock"
                    ? "stock-badge--in"
                    : p.stock === "pre-order"
                      ? "stock-badge--pre"
                      : "stock-badge--out"
                }">${escapeHtml(p.stock)}</span></td>
                <td class="admin-table__actions">
                  <button class="btn-mini" data-edit="${escapeHtml(p.id)}">Edit</button>
                  <button class="btn-mini btn-mini--danger" data-del="${escapeHtml(p.id)}">Delete</button>
                </td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

    content.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = items.find((x) => x.id === btn.dataset.edit);
        if (p) openModal(p);
      }),
    );

    content.querySelectorAll<HTMLButtonElement>("[data-del]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this product? This cannot be undone.")) return;
        try {
          await api.del(`/admin/products/${btn.dataset.del}`, true);
          toast("Product deleted");
          void renderContent();
          void loadStats();
        } catch (err) {
          toast(err instanceof ApiError ? err.message : "Delete failed", "error");
        }
      }),
    );
  }

  function renderOrdersTable(items: Order[]): void {
    if (items.length === 0) {
      content.innerHTML = `<div class="track-empty"><h3>No orders found</h3></div>`;
      return;
    }

    content.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${items
              .map(
                (o) => `
              <tr>
                <td>
                  <div class="admin-table__name">${escapeHtml(o.orderNo)}</div>
                  <div class="admin-table__sub">${new Date(o.createdAt).toLocaleString()}</div>
                </td>
                <td>
                  <div>${escapeHtml(o.customer.name)}</div>
                  <div class="admin-table__sub">${escapeHtml(o.customer.phone)}</div>
                  <div class="admin-table__sub">${escapeHtml(o.customer.address)}</div>
                </td>
                <td>${o.items.reduce((n, i) => n + i.qty, 0)}</td>
                <td>${formatBDT(o.total)}</td>
                <td>
                  ${o.paymentMethod === "bkash" ? "bKash" : "COD"}
                  ${o.bkashTrxId ? `<div class="admin-table__sub">Trx: ${escapeHtml(o.bkashTrxId)}</div>` : ""}
                </td>
                <td>
                  <select class="filter-select" data-order-status="${escapeHtml(o.id)}">
                    ${STATUS_OPTIONS.map(
                      (s) =>
                        `<option value="${s.value}" ${o.status === s.value ? "selected" : ""}>${s.label}</option>`,
                    ).join("")}
                  </select>
                  ${
                    o.status === "awaiting-verification"
                      ? `<button class="btn-mini" data-verify="${escapeHtml(o.id)}">✓ Verify bKash</button>`
                      : ""
                  }
                </td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>`;

    content.querySelectorAll<HTMLSelectElement>("[data-order-status]").forEach((sel) =>
      sel.addEventListener("change", async () => {
        try {
          await api.put(
            `/admin/orders/${sel.dataset.orderStatus}/status`,
            { status: sel.value, note: `Status changed to ${sel.value} by admin` },
            true,
          );
          toast("Order status updated");
          void loadStats();
        } catch (err) {
          toast(err instanceof ApiError ? err.message : "Update failed", "error");
        }
      }),
    );

    content.querySelectorAll<HTMLButtonElement>("[data-verify]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await api.put(
            `/admin/orders/${btn.dataset.verify}/status`,
            { status: "confirmed", note: "bKash payment verified" },
            true,
          );
          toast("bKash payment verified ✓");
          void renderContent();
          void loadStats();
        } catch (err) {
          toast(err instanceof ApiError ? err.message : "Verification failed", "error");
        }
      }),
    );
  }

  // -- Stats ----------------------------------------------------
  async function loadStats(): Promise<void> {
    try {
      const s = await api.get<AdminStats>("/admin/stats", true);
      document.getElementById("admin-stats")!.innerHTML = `
        <div class="stat-card"><span>Revenue</span><strong>${formatBDT(s.revenue)}</strong></div>
        <div class="stat-card"><span>Orders</span><strong>${s.totalOrders}</strong></div>
        <div class="stat-card"><span>Pending</span><strong>${s.pendingOrders}</strong></div>
        <div class="stat-card"><span>To Verify</span><strong>${s.awaitingVerification}</strong></div>
        <div class="stat-card"><span>Products</span><strong>${s.totalProducts}</strong></div>`;
    } catch {
      document.getElementById("admin-stats")!.innerHTML = "";
    }
  }

  // -- Product modal -------------------------------------------
  const modal = document.getElementById("product-modal")!;
  const productForm = document.getElementById("product-form") as HTMLFormElement;
  const modalTitle = document.getElementById("modal-title")!;
  const formError = document.getElementById("product-form-error")!;

  function openModal(product?: Product): void {
    modalTitle.textContent = product ? "Edit Product" : "Add Product";
    formError.hidden = true;
    const p = product ?? EMPTY_PRODUCT;

    const set = (name: string, value: string): void => {
      const el = productForm.elements.namedItem(name) as HTMLInputElement | null;
      if (el) el.value = value;
    };
    set("id", p.id);
    set("name", p.name);
    set("brand", p.brand);
    set("category", p.category);
    set("price", String(p.price));
    set("oldPrice", String(p.oldPrice));
    set("stock", p.stock);
    set("advance", p.advance ? String(p.advance) : "");
    set("rating", String(p.rating));
    set("colours", p.colours?.join(", ") ?? "");
    set("compatibility", p.compatibility?.join(", ") ?? "");
    set("connectivity", p.connectivity ?? "");

    modal.hidden = false;
  }

  function closeModal(): void {
    modal.hidden = true;
    productForm.reset();
  }

  document.getElementById("modal-close")?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.hidden = true;

    const data = new FormData(productForm);
    const split = (v: string): string[] =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const payload: Product = {
      id: String(data.get("id") ?? ""),
      name: String(data.get("name") ?? "").trim(),
      brand: String(data.get("brand") ?? "").trim(),
      category: String(data.get("category") ?? "controllers") as Product["category"],
      price: Number(data.get("price") ?? 0),
      oldPrice: Number(data.get("oldPrice") ?? 0) || Number(data.get("price") ?? 0),
      stock: String(data.get("stock") ?? "in-stock") as Product["stock"],
      advance: Number(data.get("advance")) || undefined,
      rating: Number(data.get("rating") ?? 4.5),
      colours: split(String(data.get("colours") ?? "")),
      compatibility: split(String(data.get("compatibility") ?? "")),
      connectivity: String(data.get("connectivity") ?? "").trim() || undefined,
    };

    if (!payload.name || !payload.brand || payload.price <= 0) {
      formError.textContent = "Name, brand and a price above 0 are required.";
      formError.hidden = false;
      return;
    }

    try {
      let savedProduct: Product;
      if (payload.id) {
        savedProduct = await api.put<Product>(`/admin/products/${payload.id}`, payload, true);
      } else {
        savedProduct = await api.post<Product>("/admin/products", payload, true);
      }

      // Upload images if any
      const fileInput = productForm.elements.namedItem("images") as HTMLInputElement | null;
      const files = fileInput?.files;
      if (files && files.length > 0 && savedProduct.id) {
        const imageFormData = new FormData();
        for (let i = 0; i < files.length; i++) {
          imageFormData.append("images", files[i]);
        }
        await api.post<Product>(`/admin/products/${savedProduct.id}/images`, imageFormData, true);
      }

      toast("Product saved");
      closeModal();
      void renderContent();
      void loadStats();
    } catch (err) {
      formError.textContent = err instanceof ApiError ? err.message : "Save failed";
      formError.hidden = false;
    }
  });

  // -- Init -----------------------------------------------------
  renderToolbar();
  void renderContent();
  void loadStats();
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
