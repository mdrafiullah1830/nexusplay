// ============================================================
// NEXUSPLAY — API client (fetch wrapper)
// ============================================================

const BASE: string = (
  (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL ?? "/api"
).replace(/\/+$/, "");

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${normalizedPath}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};

  const token = localStorage.getItem("nexusplay_token");
  if (options.auth && token) headers.Authorization = `Bearer ${token}`;

  const isFormData = options.body instanceof FormData;

  const res = await fetch(apiUrl(path), {
    method: options.method ?? "GET",
    headers: isFormData ? headers : { ...headers, "Content-Type": "application/json" },
    body: isFormData ? (options.body as FormData) : (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, auth = false) => request<T>(path, { auth }),
  post: <T>(path: string, body?: unknown, auth = false) =>
    request<T>(path, { method: "POST", body, auth }),
  put: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "PUT", body, auth }),
  del: <T>(path: string, auth = true) => request<T>(path, { method: "DELETE", auth }),
};
