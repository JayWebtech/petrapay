import { x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concatBytes, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * Sealed boxes for payment-link form responses.
 * The payer's browser encrypts to the creator's X25519 public key with a throwaway key pair:
 *   box1:<base64url(ephemeralPublic ‖ iv ‖ AES-GCM ciphertext)>
 * The AES key is HKDF-SHA256(ECDH(ephemeral, creator), salt = ephemeralPublic ‖ creatorPublic).
 * Only the creator's recovery phrase can open it; the server stores ciphertext it can't read.
 */

export const BOX_PREFIX = "box1:";
const INFO = utf8ToBytes("petrapay/box/v1");

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function aesKey(shared: Uint8Array, ephemeralPublic: Uint8Array, recipientPublic: Uint8Array): Promise<CryptoKey> {
  const okm = hkdf(sha256, shared, concatBytes(ephemeralPublic, recipientPublic), INFO, 32);
  return crypto.subtle.importKey("raw", new Uint8Array(okm), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypts `plaintext` so only the holder of `recipientPublicHex`'s secret can read it. */
export async function sealFor(recipientPublicHex: string, plaintext: string): Promise<string> {
  const recipient = hexToBytes(recipientPublicHex);
  const ephemeral = x25519.utils.randomSecretKey();
  const ephemeralPublic = x25519.getPublicKey(ephemeral);
  const key = await aesKey(x25519.getSharedSecret(ephemeral, recipient), ephemeralPublic, recipient);
  ephemeral.fill(0);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new Uint8Array(utf8ToBytes(plaintext))));
  return BOX_PREFIX + toBase64Url(concatBytes(ephemeralPublic, iv, ct));
}

/**
 * Opens a sealed box given a way to compute ECDH with the recipient's secret key
 * (a non-extractable WebCrypto key on most devices, raw bytes on the rest).
 */
export async function openSealed(
  sealed: string,
  recipientPublicHex: string,
  sharedSecret: (ephemeralPublic: Uint8Array) => Promise<Uint8Array>,
): Promise<string> {
  if (!sealed.startsWith(BOX_PREFIX)) throw new Error("Not a sealed box");
  const raw = fromBase64Url(sealed.slice(BOX_PREFIX.length));
  if (raw.length < 32 + 12 + 16) throw new Error("Sealed box is truncated");
  const ephemeralPublic = raw.slice(0, 32);
  const key = await aesKey(await sharedSecret(ephemeralPublic), ephemeralPublic, hexToBytes(recipientPublicHex));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(32, 44) }, key, raw.slice(44));
  return new TextDecoder().decode(pt);
}

/** What a payer entered in a payment link's form, in the link's field order. */
export type SealedResponses = { v: 1; fields: { id: string; label: string; value: string }[] };
