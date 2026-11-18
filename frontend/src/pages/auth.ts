// ============================================================
// NEXUSPLAY — Login / Register pages
// ============================================================
import { auth } from "../services/auth";
import { ApiError } from "../services/api";
import { toast } from "../services/toast";
import { refreshAccountArea } from "../components/navbar";

function redirectTarget(): string {
  const p = new URLSearchParams(window.location.search);
  return p.get("redirect") ?? "/";
}

export function initAuthPages(): void {
  const form = document.getElementById("auth-form") as HTMLFormElement | null;
  if (!form) return;

  const mode = document.body.dataset.page; // "login" | "register"
  const errorBox = document.getElementById("auth-error");
  const submitBtn = form.querySelector<HTMLButtonElement>("#auth-submit");

  // Already logged in → go where they were headed
  if (auth.isLoggedIn() && !auth.isExpired()) {
    window.location.href = redirectTarget();
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorBox) errorBox.hidden = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = mode === "login" ? "Logging in…" : "Creating account…";
    }

    const data = new FormData(form);

    try {
      if (mode === "login") {
        await auth.login(String(data.get("email") ?? ""), String(data.get("password") ?? ""));
      } else {
        const name = String(data.get("name") ?? "").trim();
        const email = String(data.get("email") ?? "").trim();
        const password = String(data.get("password") ?? "");
        const phone = String(data.get("phone") ?? "").trim();

        if (!name || !email || !password) throw new ApiError(400, "All fields are required");
        if (password.length < 6)
          throw new ApiError(400, "Password must be at least 6 characters");

        await auth.register(name, email, password, phone || undefined);
      }

      toast(mode === "login" ? "Welcome back!" : "Account created!");
      refreshAccountArea();
      window.location.href = redirectTarget();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
      if (errorBox) {
        errorBox.textContent = msg;
        errorBox.hidden = false;
      }
      toast(msg, "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = mode === "login" ? "Log In" : "Create Account";
      }
    }
  });
}
