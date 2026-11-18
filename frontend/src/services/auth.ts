// ============================================================
// NEXUSPLAY — Auth (JWT in localStorage)
// ============================================================
import { api } from "./api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = "nexusplay_token";
const USER_KEY = "nexusplay_user";

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    const json = decodeURIComponent(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const auth = {
  token: (): string | null => localStorage.getItem(TOKEN_KEY),

  user: (): AuthUser | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  },

  isLoggedIn: (): boolean => !!auth.token(),

  isAdmin: (): boolean => auth.user()?.role === "admin",

  isExpired: (): boolean => {
    const claims = auth.token() ? decodeJwt(auth.token()!) : null;
    if (!claims || typeof claims.exp !== "number") return false;
    return claims.exp * 1000 < Date.now();
  },

  login: async (email: string, password: string): Promise<AuthUser> => {
    const res = await api.post<AuthResponse>("/auth/login", { email, password });
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    return res.user;
  },

  register: async (name: string, email: string, password: string, phone?: string) => {
    const res = await api.post<AuthResponse>("/auth/register", { name, email, password, phone });
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    return res.user;
  },

  logout: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  },
};
