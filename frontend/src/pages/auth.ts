// ============================================================
// NEXUSPLAY — Login / Register pages
// ============================================================
import { auth } from "../services/auth";
import { ApiError } from "../services/api";
import { toast } from "../services/toast";
import { refreshAccountArea } from "../components/navbar";

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type: string;
          theme: string;
          size: string;
          text: string;
          shape: string;
          width: number;
        },
      ): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
    onGoogleLibraryLoad?: () => void;
  }
}

function redirectTarget(): string {
  const p = new URLSearchParams(window.location.search);
  return p.get("redirect") ?? "/";
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const finish = (): void => {
      if (window.google) resolve();
      else reject(new Error("Google Sign-In could not be loaded"));
    };

    window.onGoogleLibraryLoad = finish;

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Sign-In could not be loaded")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Sign-In could not be loaded")), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export function initAuthPages(): void {
  const form = document.getElementById("auth-form") as HTMLFormElement | null;
  if (!form) return;

  const googleButton = document.getElementById("google-signin-button");
  const googleError = document.getElementById("google-signin-error");
  const linkForm = document.getElementById("google-link-form") as HTMLFormElement | null;
  const linkError = document.getElementById("google-link-error");
  const linkSubmit = document.getElementById("google-link-submit") as HTMLButtonElement | null;
  let pendingGoogleCredential: string | null = null;
  let pendingCsrfToken: string | null = null;

  const showGoogleError = (message: string): void => {
    if (!googleError) return;
    googleError.textContent = message;
    googleError.hidden = false;
  };

  const completeGoogleLogin = async (password?: string): Promise<void> => {
    if (!pendingGoogleCredential || !pendingCsrfToken) return;

    if (linkSubmit) {
      linkSubmit.disabled = true;
      linkSubmit.textContent = "Connecting…";
    }
    if (linkError) linkError.hidden = true;

    try {
      await auth.googleLogin(pendingGoogleCredential, pendingCsrfToken, password);
      toast("Welcome to NexusPlay!");
      refreshAccountArea();
      window.location.href = redirectTarget();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Google Sign-In failed. Please try again.";
      if (err instanceof ApiError && err.code === "password_required" && linkForm) {
        linkForm.hidden = false;
        const passwordInput = document.getElementById("google-link-password") as HTMLInputElement | null;
        passwordInput?.focus();
        if (linkError) {
          linkError.textContent = message;
          linkError.hidden = false;
        }
      } else if (linkError && !linkForm?.hidden) {
        linkError.textContent = message;
        linkError.hidden = false;
      } else {
        showGoogleError(message);
      }
      if (linkSubmit) {
        linkSubmit.disabled = false;
        linkSubmit.textContent = "Connect Google account";
      }
    }
  };

  const mode = document.body.dataset.page; // "login" | "register"
  const errorBox = document.getElementById("auth-error");
  const submitBtn = form.querySelector<HTMLButtonElement>("#auth-submit");

  // Already logged in → go where they were headed
  if (auth.isLoggedIn() && !auth.isExpired()) {
    window.location.href = redirectTarget();
    return;
  }

  void (async () => {
    if (!googleButton) return;

    try {
      const config = await auth.googleConfig();
      if (!config.enabled || !config.clientId || !config.csrfToken) {
        googleButton.hidden = true;
        document.querySelector<HTMLElement>(".auth-divider")?.remove();
        return;
      }

      pendingCsrfToken = config.csrfToken;
      await loadGoogleIdentityServices();
      if (!window.google) throw new Error("Google Sign-In could not be loaded");

      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: async ({ credential }) => {
          pendingGoogleCredential = credential;
          if (googleError) googleError.hidden = true;

          try {
            await completeGoogleLogin();
          } catch (err) {
            showGoogleError(
              err instanceof ApiError ? err.message : "Google Sign-In failed. Please try again.",
            );
          }
        },
      });

      const width = Math.min(googleButton.clientWidth || 400, 400);
      window.google.accounts.id.renderButton(googleButton, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: mode === "login" ? "signin_with" : "signup_with",
        shape: "rectangular",
        width,
      });
    } catch {
      googleButton.hidden = true;
      document.querySelector<HTMLElement>(".auth-divider")?.remove();
      showGoogleError("Google Sign-In is temporarily unavailable. Please use email and password.");
    }
  })();

  linkForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const passwordInput = document.getElementById("google-link-password") as HTMLInputElement | null;
    void completeGoogleLogin(passwordInput?.value ?? "");
  });

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
