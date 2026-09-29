import { randomBytes } from "node:crypto";

const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/** Unguessable, URL-friendly id (base56, no look-alike characters). */
export function publicId(length = 12): string {
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    const b = bytes[i]!;
    // Rejection sampling keeps the distribution uniform.
    if (b < 256 - (256 % ALPHABET.length)) out += ALPHABET[b % ALPHABET.length];
  }
  return out.length === length ? out : publicId(length);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
