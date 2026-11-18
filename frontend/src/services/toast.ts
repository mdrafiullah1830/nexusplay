// ============================================================
// NEXUSPLAY — Toast notifications
// ============================================================

let container: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;";
    document.body.appendChild(container);
  }
  return container;
}

export function toast(message: string, type: "success" | "error" = "success"): void {
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = `
    background:${type === "success" ? "#111" : "#d33b3b"};
    color:${type === "success" ? "#d7ff3e" : "#fff"};
    font-family:Inter,sans-serif;font-size:14px;font-weight:600;
    padding:12px 22px;border-radius:999px;
    box-shadow:0 8px 24px rgba(0,0,0,.25);
    opacity:0;transform:translateY(10px);
    transition:opacity .25s,transform .25s;`;

  ensureContainer().appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    setTimeout(() => el.remove(), 300);
  }, 2600);
}
