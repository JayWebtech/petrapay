import { device } from '../native/device';
import { secureStore } from '../native/secureStore';
import type { Currency, Me, Sale } from './types';

/**
 * Talks to the PetraPay server as this terminal. The terminal's token (from
 * pairing) and the server it paired with are kept in Keystore-encrypted storage.
 * The token can only ring up and view this terminal's sales.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

const TOKEN_KEY = 'pos_token';
const SERVER_KEY = 'pos_server';

let token: string | null = null;
let server = device.apiBaseUrl;
let onUnpaired: ((reason: string) => void) | null = null;

export const defaultServer = device.apiBaseUrl;

/** Normalises what someone typed: no trailing slash, https assumed. */
export function cleanServer(url: string): string {
  const t = url.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** On launch: the remembered pairing, if any. */
export async function restorePairing(): Promise<boolean> {
  const [t, s] = await Promise.all([secureStore.get(TOKEN_KEY), secureStore.get(SERVER_KEY)]);
  if (s) server = s;
  token = t;
  return !!t;
}

async function rememberPairing(t: string, s: string) {
  token = t;
  server = s;
  await Promise.all([secureStore.set(TOKEN_KEY, t), secureStore.set(SERVER_KEY, s)]);
}

export async function forgetPairing() {
  token = null;
  await secureStore.remove(TOKEN_KEY);
}

/** Called when the server says this terminal was removed from the account. */
export function onTerminalRemoved(fn: (reason: string) => void) {
  onUnpaired = fn;
}

async function call<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: { body?: unknown; idempotencyKey?: string; base?: string; timeoutMs?: number } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(`${opts.base ?? server}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError("Can't reach PetraPay. Check this terminal's internet connection.", 0);
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    const message = data?.error ?? (res.status >= 500 ? 'PetraPay had a problem. Try again in a moment.' : `Request failed (${res.status})`);
    if (res.status === 401 && token && path !== '/terminal/pair') onUnpaired?.(message);
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  async pair(code: string, deviceName: string, serverUrl: string): Promise<void> {
    const base = cleanServer(serverUrl);
    const res = await call<{ token: string }>('POST', '/terminal/pair', { body: { code, deviceName }, base });
    await rememberPairing(res.token, base);
  },
  me: () => call<Me>('GET', '/terminal/me'),
  createSale: (input: { amount: string; currency: Currency; note?: string }, idempotencyKey: string) =>
    call<Sale>('POST', '/terminal/sales', { body: input, idempotencyKey }),
  sale: (id: string, withQr = false) => call<Sale>('GET', `/terminal/sales/${id}${withQr ? '?qr=1' : ''}`),
  sales: (limit = 30) => call<Sale[]>('GET', `/terminal/sales?limit=${limit}`),
  cancelSale: (id: string) => call<Sale>('POST', `/terminal/sales/${id}/cancel`),
  server: () => server,
};
