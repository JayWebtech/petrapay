"use client";

import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { fromBase64Url, openSealed, toBase64Url } from "./box";

/**
 * Account identity: a 12-word recovery phrase deterministically derives
 *   - an ed25519 signing key (the account), and
 *   - an AES-GCM "notes" key that encrypts private fields (like client names) before upload, and
 *   - an X25519 "box" key pair: payers seal payment-link form answers to its public half.
 * The phrase is shown once and never leaves the browser. On this device both keys are kept as
 * non-extractable WebCrypto keys in IndexedDB, so page scripts can use them but can't read them.
 * Browsers without WebCrypto Ed25519 fall back to storing the raw signing key in IndexedDB.
 */

const DB_NAME = "petrapay";
const STORE = "identity";
const KEY_ID = "device-key";
const DOMAIN = utf8ToBytes("petrapay/identity/v1");
const NOTES_DOMAIN = utf8ToBytes("petrapay/notes/v1");
const BOX_DOMAIN = utf8ToBytes("petrapay/box/v1");
const SEALED_PREFIX = "enc1:";

type StoredIdentity = ({ kind: "webcrypto"; publicKey: string; privateKey: CryptoKey } | { kind: "raw"; publicKey: string; secretKey: string }) & {
  notesKey?: CryptoKey;
  /** Absent on devices set up before payment links existed. `key` is raw hex where WebCrypto lacks X25519. */
  box?: { publicKey: string; key: CryptoKey | string };
};

export function createRecoveryPhrase(): string {
  return generateMnemonic(wordlist, 128);
}

export function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase().split(/\s+/).join(" ");
}

export function isValidPhrase(phrase: string): boolean {
  return validateMnemonic(normalizePhrase(phrase), wordlist);
}

function secretFromPhrase(phrase: string): Uint8Array {
  const seed = mnemonicToSeedSync(normalizePhrase(phrase));
  return sha256(concatBytes(DOMAIN, seed));
}

function notesSecretFromPhrase(phrase: string): Uint8Array {
  const seed = mnemonicToSeedSync(normalizePhrase(phrase));
  return sha256(concatBytes(NOTES_DOMAIN, seed));
}

function boxSecretFromPhrase(phrase: string): Uint8Array {
  const seed = mnemonicToSeedSync(normalizePhrase(phrase));
  return sha256(concatBytes(BOX_DOMAIN, seed));
}

export function publicKeyFromPhrase(phrase: string): string {
  return bytesToHex(ed25519.getPublicKey(secretFromPhrase(phrase)));
}

// ---------- Change notifications ----------

// Bumped whenever this device's stored keys change, so views that decrypt can retry.
let version = 0;
const listeners = new Set<() => void>();

export function subscribeIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const identityVersion = () => version;

function identityChanged() {
  version += 1;
  for (const l of listeners) l();
}

// ---------- IndexedDB ----------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

// PKCS#8 wrapper for a raw 32-byte Ed25519 private key (RFC 8410).
const PKCS8_PREFIX = hexToBytes("302e020100300506032b657004220420");

async function importNonExtractable(secret: Uint8Array): Promise<CryptoKey | null> {
  try {
    const pkcs8 = concatBytes(PKCS8_PREFIX, secret);
    return await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  } catch {
    return null;
  }
}

async function importBoxKey(secret: Uint8Array, publicKey: Uint8Array): Promise<CryptoKey | null> {
  try {
    const jwk: JsonWebKey = { kty: "OKP", crv: "X25519", d: toBase64Url(secret), x: toBase64Url(publicKey) };
    return await crypto.subtle.importKey("jwk", jwk, { name: "X25519" }, false, ["deriveBits"]);
  } catch {
    return null;
  }
}

/** Derives the key from the phrase and remembers it on this device. Returns the public key (hex). */
export async function saveIdentity(phrase: string): Promise<string> {
  const secret = secretFromPhrase(phrase);
  const publicKey = bytesToHex(ed25519.getPublicKey(secret));
  const privateKey = await importNonExtractable(secret);
  const notesSecret = notesSecretFromPhrase(phrase);
  const notesKey = await crypto.subtle.importKey("raw", new Uint8Array(notesSecret), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const boxSecret = boxSecretFromPhrase(phrase);
  const boxPublic = x25519.getPublicKey(boxSecret);
  const box = { publicKey: bytesToHex(boxPublic), key: (await importBoxKey(boxSecret, boxPublic)) ?? bytesToHex(boxSecret) };
  const record: StoredIdentity = privateKey
    ? { kind: "webcrypto", publicKey, privateKey, notesKey, box }
    : { kind: "raw", publicKey, secretKey: bytesToHex(secret), notesKey, box };
  await idb("readwrite", (s) => s.put(record, KEY_ID));
  secret.fill(0);
  notesSecret.fill(0);
  boxSecret.fill(0);
  identityChanged();
  return publicKey;
}

export async function loadIdentity(): Promise<StoredIdentity | null> {
  try {
    return (await idb<StoredIdentity | undefined>("readonly", (s) => s.get(KEY_ID))) ?? null;
  } catch {
    return null;
  }
}

export async function forgetIdentity(): Promise<void> {
  try {
    await idb("readwrite", (s) => s.delete(KEY_ID));
  } catch {
    // Nothing stored.
  }
  identityChanged();
}

export async function signMessage(identity: StoredIdentity, message: string): Promise<string> {
  const bytes = utf8ToBytes(message);
  if (identity.kind === "webcrypto") {
    const sig = await crypto.subtle.sign({ name: "Ed25519" }, identity.privateKey, bytes);
    return bytesToHex(new Uint8Array(sig));
  }
  return bytesToHex(ed25519.sign(bytes, hexToBytes(identity.secretKey)));
}

// ---------- Private notes ----------

export function isSealed(value: string | null | undefined): boolean {
  return !!value && value.startsWith(SEALED_PREFIX);
}

/** Encrypts a private note on this device. Returns null if this device has no notes key. */
export async function sealNote(plaintext: string): Promise<string | null> {
  const identity = await loadIdentity();
  if (!identity?.notesKey) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, identity.notesKey, utf8ToBytes(plaintext)));
  return SEALED_PREFIX + toBase64Url(concatBytes(iv, ct));
}

/** Decrypts a sealed note. Plain (legacy) values pass through; undecryptable ones return null. */
export async function openNote(value: string): Promise<string | null> {
  if (!isSealed(value)) return value;
  const identity = await loadIdentity();
  if (!identity?.notesKey) return null;
  try {
    const raw = fromBase64Url(value.slice(SEALED_PREFIX.length));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, identity.notesKey, raw.slice(12));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

// ---------- Sealed form responses ----------

/** The box public key this device can open, or null on devices set up before payment links. */
export async function deviceBoxKey(): Promise<string | null> {
  return (await loadIdentity())?.box?.publicKey ?? null;
}

/** Opens a payment-link response sealed to this account. Null when this device can't. */
export async function openBox(sealed: string): Promise<string | null> {
  const box = (await loadIdentity())?.box;
  if (!box) return null;
  try {
    return await openSealed(sealed, box.publicKey, async (ephemeralPublic) => {
      if (typeof box.key === "string") return x25519.getSharedSecret(hexToBytes(box.key), ephemeralPublic);
      const peer = await crypto.subtle.importKey("raw", new Uint8Array(ephemeralPublic), { name: "X25519" }, false, []);
      return new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: peer }, box.key, 256));
    });
  } catch {
    return null;
  }
}

/** Short, human-checkable fingerprint of a public key, e.g. "3F9A·C21B·77E0". */
export function fingerprint(publicKeyHex: string): string {
  const h = publicKeyHex.slice(0, 12).toUpperCase();
  return `${h.slice(0, 4)}·${h.slice(4, 8)}·${h.slice(8, 12)}`;
}
