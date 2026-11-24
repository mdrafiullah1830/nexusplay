// ============================================================
// NEXUSPLAY — API client (fetch wrapper)
// ============================================================

const BASE: string = (import.meta as ImportMeta & { env?: Record<string, string> }).env
  ?.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };

  const token = localStorage.getItem("nexusplay_token");
  if (options.auth && token) headers.Authorization = `Bearer ${token}`;

  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers: isFormData ? headers : { ...headers, "Content-Type": "application/json" },
    body: isFormData ? (options.body as FormData) : (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    credentials: "include",
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ?? `Request failed (${res.status})`;
    const code =
      data && typeof data === "object" && "code" in data
        ? String((data as { code: unknown }).code)
        : undefined;
    throw new ApiError(res.status, message, code);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, auth = false) => request<T>(path, { auth }),
  post: <T>(path: string, body?: unknown, auth = false, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body, auth, headers }),
  put: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: "PUT", body, auth }),
  del: <T>(path: string, auth = true) => request<T>(path, { method: "DELETE", auth }),
};
