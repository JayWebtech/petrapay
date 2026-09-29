import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkSettlementAddress, decodeUnifiedAddress, parseZcashAddress, zip321Uri } from "../src/zcash.ts";
import { toBaseUnits, fromBaseUnits, usdToBaseUnits } from "../src/amount.ts";

// Official ZIP-316 test vectors (zcash/zcash-test-vectors, unified_address.json)
const vectors: { ua: string; transparent: boolean; sapling: boolean; orchard: boolean; unknown: number | null }[] =
  JSON.parse(readFileSync(new URL("./ua-vectors.json", import.meta.url), "utf8"));

test("decodes every ZIP-316 unified address vector", () => {
  assert.ok(vectors.length > 10);
  for (const v of vectors) {
    const { network, receivers } = decodeUnifiedAddress(v.ua);
    assert.equal(network, "main");
    assert.equal(receivers.transparent, v.transparent, v.ua);
    assert.equal(receivers.sapling, v.sapling, v.ua);
    assert.equal(receivers.orchard, v.orchard, v.ua);
    assert.deepEqual(receivers.unknown, v.unknown === null ? [] : [v.unknown]);
  }
});

test("rejects a unified address with a flipped character", () => {
  const ua = vectors[0]!.ua;
  const tampered = ua.slice(0, 20) + (ua[20] === "q" ? "p" : "q") + ua.slice(21);
  assert.throws(() => decodeUnifiedAddress(tampered));
});

test("settlement requires an Orchard receiver", () => {
  const orchard = vectors.find((v) => v.orchard && !v.transparent)!;
  const saplingOnly = vectors.find((v) => v.sapling && !v.orchard && !v.transparent);
  const withTransparent = vectors.find((v) => v.orchard && v.transparent)!;
  assert.equal(checkSettlementAddress(orchard.ua).ok, true);
  const t = checkSettlementAddress(withTransparent.ua);
  assert.equal(t.ok, true);
  assert.ok(t.ok && t.warnings.length === 1);
  if (saplingOnly) assert.equal(checkSettlementAddress(saplingOnly.ua).ok, false);
});

test("parses transparent addresses and rejects them for settlement", () => {
  const t = "t1LnFUFV3qJQd9n7DCpJZ3sUhpX8bzsbFFZ";
  assert.deepEqual(parseZcashAddress(t), { kind: "transparent", network: "main", type: "p2pkh" });
  assert.equal(checkSettlementAddress(t).ok, false);
  assert.throws(() => parseZcashAddress("t1LnFUFV3qJQd9n7DCpJZ3sUhpX8bzsbFFa"));
});

test("zip321 uri", () => {
  assert.equal(zip321Uri({ address: "u1abc", amountZats: 12_345_000n }), "zcash:u1abc?amount=0.12345");
  assert.equal(zip321Uri({ address: "u1abc", amountZats: 100_000_000n, memo: "hi" }), "zcash:u1abc?amount=1&memo=aGk");
});

test("amount helpers", () => {
  assert.equal(toBaseUnits("1.5", 6), 1_500_000n);
  assert.equal(toBaseUnits("0.1234567", 6), 123_456n);
  assert.equal(fromBaseUnits(1_500_000n, 6), "1.5");
  assert.equal(fromBaseUnits("100000000", 8), "1");
  // $250 of ZEC at $1475.07 = 0.16948...ZEC, rounded up to the next zat
  assert.equal(usdToBaseUnits("250", 1475.07, 8), 16948349n);
});
