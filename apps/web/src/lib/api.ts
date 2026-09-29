export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Browser-side API client. Requests go through the Next.js `/api` rewrite so cookies stay first-party. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
    signal: init.signal,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { error?: string; details?: unknown } | null;
  if (!res.ok) {
    const message = data?.error ?? (res.status >= 500 ? "Server error. Try again." : `Request failed (${res.status})`);
    throw new ApiError(res.status, message, data?.details);
  }
  return data as T;
}

/** Server-side fetch straight to the API (used by server components for SEO-friendly pages). */
export async function serverApi<T>(path: string): Promise<T | null> {
  const base = process.env.API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${base}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Server-side fetch cached for `revalidate` seconds (ISR). Returns null if the API is unreachable, e.g. during a build. */
export async function serverApiCached<T>(path: string, revalidate: number): Promise<T | null> {
  const base = process.env.API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${base}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
