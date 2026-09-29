import { blake2b } from "@noble/hashes/blake2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58, bech32m } from "@scure/base";

/**
 * Zcash address utilities.
 *
 * Settlement goes through NEAR Intents' ZEC bridge, which accepts:
 *   - transparent addresses (t1 / t3)
 *   - unified addresses (u1…) that contain an Orchard receiver
 * It rejects Sapling-only unified addresses and raw `zs` addresses. PetraPay only
 * settles to unified addresses with an Orchard receiver so funds land shielded.
 */

export const ZATS_PER_ZEC = 100_000_000n;
export const ZEC_DECIMALS = 8;

export type UnifiedReceivers = {
  orchard: boolean;
  sapling: boolean;
  transparent: boolean;
  unknown: number[];
};

export type ZcashAddressInfo =
  | { kind: "unified"; network: "main" | "test"; receivers: UnifiedReceivers }
  | { kind: "transparent"; network: "main"; type: "p2pkh" | "p2sh" }
  | { kind: "sapling"; network: "main" | "test" };

// ---------- F4Jumble (ZIP-316) ----------

const PERSONAL_H = new TextEncoder().encode("UA_F4Jumble_H");
const PERSONAL_G = new TextEncoder().encode("UA_F4Jumble_G");
const HASH_LEN = 64;

function personalization(prefix: Uint8Array, i: number, j: number): Uint8Array {
  const p = new Uint8Array(16);
  p.set(prefix, 0);
  p[13] = i;
  p[14] = j & 0xff;
  p[15] = (j >> 8) & 0xff;
  return p;
}

function hashH(i: number, u: Uint8Array, outLen: number): Uint8Array {
  return blake2b(u, { dkLen: outLen, personalization: personalization(PERSONAL_H, i, 0) });
}

function hashG(i: number, u: Uint8Array, outLen: number): Uint8Array {
  const out = new Uint8Array(outLen);
  const blocks = Math.ceil(outLen / HASH_LEN);
  for (let j = 0; j < blocks; j++) {
    const block = blake2b(u, { dkLen: HASH_LEN, personalization: personalization(PERSONAL_G, i, j) });
    out.set(block.subarray(0, Math.min(HASH_LEN, outLen - j * HASH_LEN)), j * HASH_LEN);
  }
  return out;
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! ^ b[i]!;
  return out;
}

export function f4jumbleInv(m: Uint8Array): Uint8Array {
  if (m.length < 48 || m.length > 4194368) throw new Error("F4Jumble: invalid length");
  const lenL = Math.min(HASH_LEN, Math.floor(m.length / 2));
  const lenR = m.length - lenL;
  const c = m.subarray(0, lenL);
  const d = m.subarray(lenL);
  const y = xor(c, hashH(1, d, lenL));
  const x = xor(d, hashG(1, y, lenR));
  const a = xor(y, hashH(0, x, lenL));
  const b = xor(x, hashG(0, a, lenR));
  const out = new Uint8Array(m.length);
  out.set(a, 0);
  out.set(b, lenL);
  return out;
}

function readCompactSize(buf: Uint8Array, offset: number): [value: number, next: number] {
  const first = buf[offset];
  if (first === undefined) throw new Error("truncated");
  if (first < 0xfd) return [first, offset + 1];
  if (first === 0xfd) {
    if (offset + 3 > buf.length) throw new Error("truncated");
    return [buf[offset + 1]! | (buf[offset + 2]! << 8), offset + 3];
  }
  if (first === 0xfe) {
    if (offset + 5 > buf.length) throw new Error("truncated");
    const v = buf[offset + 1]! | (buf[offset + 2]! << 8) | (buf[offset + 3]! << 16) | (buf[offset + 4]! << 24);
    return [v >>> 0, offset + 5];
  }
  throw new Error("compactSize too large");
}

/** Decode a unified address (u1… / utest1…) and report which receivers it contains. */
export function decodeUnifiedAddress(address: string): { network: "main" | "test"; receivers: UnifiedReceivers } {
  const lower = address.trim().toLowerCase();
  const { prefix, words } = bech32m.decode(lower as `${string}1${string}`, false);
  if (prefix !== "u" && prefix !== "utest") throw new Error("Not a unified address");
  const jumbled = bech32m.fromWords(words);
  const raw = f4jumbleInv(jumbled);

  // Last 16 bytes are the HRP right-padded with zeros.
  const padding = raw.subarray(raw.length - 16);
  const expected = new Uint8Array(16);
  expected.set(new TextEncoder().encode(prefix));
  for (let i = 0; i < 16; i++) if (padding[i] !== expected[i]) throw new Error("Invalid unified address padding");

  const body = raw.subarray(0, raw.length - 16);
  const receivers: UnifiedReceivers = { orchard: false, sapling: false, transparent: false, unknown: [] };
  let offset = 0;
  let lastTypecode = -1;
  while (offset < body.length) {
    const [typecode, o1] = readCompactSize(body, offset);
    const [length, o2] = readCompactSize(body, o1);
    if (o2 + length > body.length) throw new Error("Invalid unified address item length");
    if (typecode <= lastTypecode) throw new Error("Unified address items out of order");
    lastTypecode = typecode;
    switch (typecode) {
      case 0x00:
      case 0x01:
        if (length !== 20) throw new Error("Invalid transparent receiver");
        receivers.transparent = true;
        break;
      case 0x02:
        if (length !== 43) throw new Error("Invalid Sapling receiver");
        receivers.sapling = true;
        break;
      case 0x03:
        if (length !== 43) throw new Error("Invalid Orchard receiver");
        receivers.orchard = true;
        break;
      default:
        receivers.unknown.push(typecode);
    }
    offset = o2 + length;
  }
  if (!receivers.orchard && !receivers.sapling && !receivers.transparent && receivers.unknown.length === 0) {
    throw new Error("Unified address has no receivers");
  }
  return { network: prefix === "u" ? "main" : "test", receivers };
}

function base58checkDecode(address: string): Uint8Array {
  const data = base58.decode(address);
  if (data.length < 5) throw new Error("too short");
  const payload = data.subarray(0, data.length - 4);
  const checksum = data.subarray(data.length - 4);
  const hash = sha256(sha256(payload));
  for (let i = 0; i < 4; i++) if (hash[i] !== checksum[i]) throw new Error("Bad checksum");
  return payload;
}

export function parseZcashAddress(address: string): ZcashAddressInfo {
  const a = address.trim();
  if (/^(u|utest)1/i.test(a)) {
    const { network, receivers } = decodeUnifiedAddress(a);
    return { kind: "unified", network, receivers };
  }
  if (/^t[13]/.test(a)) {
    const payload = base58checkDecode(a);
    if (payload.length !== 22) throw new Error("Invalid transparent address");
    const prefix = (payload[0]! << 8) | payload[1]!;
    if (prefix === 0x1cb8) return { kind: "transparent", network: "main", type: "p2pkh" };
    if (prefix === 0x1cbd) return { kind: "transparent", network: "main", type: "p2sh" };
    throw new Error("Unknown transparent address prefix");
  }
  if (/^zs1/i.test(a)) return { kind: "sapling", network: "main" };
  if (/^ztestsapling1/i.test(a)) return { kind: "sapling", network: "test" };
  throw new Error("Unrecognized Zcash address");
}

export type SettlementCheck =
  | { ok: true; receivers: UnifiedReceivers; warnings: string[] }
  | { ok: false; error: string };

/**
 * Checks whether an address can receive shielded settlement through NEAR Intents.
 * Requires a mainnet unified address with an Orchard receiver.
 */
export function checkSettlementAddress(address: string): SettlementCheck {
  let info: ZcashAddressInfo;
  try {
    info = parseZcashAddress(address);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid Zcash address" };
  }
  if (info.kind === "transparent") {
    return { ok: false, error: "Transparent (t-) addresses are public. Use a shielded unified address (u1…) from Zashi or another Orchard wallet." };
  }
  if (info.kind === "sapling") {
    return { ok: false, error: "Sapling-only addresses aren't supported. Use a unified address (u1…) with an Orchard receiver." };
  }
  if (info.network !== "main") return { ok: false, error: "Testnet addresses can't receive mainnet settlement." };
  if (!info.receivers.orchard) {
    return { ok: false, error: "This unified address has no Orchard receiver, which the bridge requires. Generate a fresh address in Zashi." };
  }
  const warnings: string[] = [];
  if (info.receivers.transparent) {
    warnings.push("Includes a transparent receiver. Senders should use Orchard, but a shielded-only address removes any chance of a public payment.");
  }
  return { ok: true, receivers: info.receivers, warnings };
}

/** Refund addresses for ZEC withdrawals may be transparent or unified (with Orchard). */
export function checkZecRefundAddress(address: string): { ok: true } | { ok: false; error: string } {
  try {
    const info = parseZcashAddress(address);
    if (info.kind === "sapling") return { ok: false, error: "Sapling-only addresses aren't supported. Use a unified address." };
    if (info.kind === "unified" && !info.receivers.orchard && !info.receivers.transparent) {
      return { ok: false, error: "Refund address needs an Orchard or transparent receiver." };
    }
    if (info.network !== "main") return { ok: false, error: "Use a mainnet address." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid Zcash address" };
  }
}

/** Builds a ZIP-321 payment URI that Zashi and other Zcash wallets can scan. */
export function zip321Uri(params: { address: string; amountZats?: bigint | string; memo?: string; label?: string }): string {
  const query: string[] = [];
  if (params.amountZats !== undefined) query.push(`amount=${formatZats(BigInt(params.amountZats))}`);
  if (params.memo) {
    // Memos are base64url without padding and only valid for shielded recipients.
    const bytes = new TextEncoder().encode(params.memo);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    query.push(`memo=${b64}`);
  }
  if (params.label) query.push(`label=${encodeURIComponent(params.label)}`);
  return `zcash:${params.address}${query.length ? `?${query.join("&")}` : ""}`;
}

export function formatZats(zats: bigint): string {
  const neg = zats < 0n;
  const abs = neg ? -zats : zats;
  const whole = abs / ZATS_PER_ZEC;
  const frac = (abs % ZATS_PER_ZEC).toString().padStart(8, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export function shortAddress(address: string, head = 8, tail = 6): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
