import type { BillTo } from "@petrapay/shared";
import { fromBase64Url, toBase64Url } from "./box";
import { openNote, sealNote } from "./identity";

/**
 * Client details ("billed to") are visible to whoever has the invoice link, and nobody else.
 * Each invoice gets a random 256-bit share key that lives only in the link's #fragment
 * (browsers never send fragments to servers). The details are AES-GCM sealed with it ("sk1:…"),
 * and the key itself is sealed with the creator's notes key so their dashboard can rebuild the link.
 */

const PREFIX = "sk1:";
export const FRAGMENT_PARAM = "k";

async function importKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new Uint8Array(fromBase64Url(keyB64)), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function newShareKey(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function sealWithKey(keyB64: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(keyB64), new TextEncoder().encode(plaintext)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return PREFIX + toBase64Url(out);
}

export async function openWithKey(keyB64: string, sealed: string): Promise<string | null> {
  if (!sealed.startsWith(PREFIX)) return null;
  try {
    const raw = fromBase64Url(sealed.slice(PREFIX.length));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await importKey(keyB64), raw.slice(12));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export function parseBillTo(plain: string | null): BillTo | null {
  if (!plain) return null;
  try {
    const data = JSON.parse(plain) as BillTo;
    if (data.v !== 1) return null;
    return { v: 1, name: typeof data.name === "string" ? data.name : undefined, email: typeof data.email === "string" ? data.email : undefined };
  } catch {
    return null;
  }
}

export async function openBillTo(keyB64: string, sealed: string): Promise<BillTo | null> {
  return parseBillTo(await openWithKey(keyB64, sealed));
}

/** Recovers an invoice's share key on the creator's device. Null if this device can't open it. */
export async function openShareKey(sealedKey: string): Promise<string | null> {
  return openNote(sealedKey);
}

/**
 * Seals client details for upload, reusing `existingKey` when the invoice already has one so links
 * the creator has already sent keep working. Returns null if this device has no notes key.
 */
export async function sealBillTo(details: { name: string; email: string }, existingKey?: string | null) {
  const key = existingKey ?? newShareKey();
  const billToKey = await sealNote(key);
  if (!billToKey) return null;
  const body: BillTo = { v: 1, ...(details.name ? { name: details.name } : {}), ...(details.email ? { email: details.email } : {}) };
  return { key, billTo: await sealWithKey(key, JSON.stringify(body)), billToKey };
}

/** The share key from the current page's #fragment, if there is one. */
export function keyFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const key = params.get(FRAGMENT_PARAM);
  return key && /^[A-Za-z0-9_-]{43}$/.test(key) ? key : null;
}

export function withShareKey(url: string, key: string | null): string {
  return key ? `${url}#${FRAGMENT_PARAM}=${key}` : url;
}
