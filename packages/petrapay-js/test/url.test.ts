import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutUrl } from "../src/core.ts";

test("payment links open /l/<id>", () => {
  assert.equal(checkoutUrl({ paymentId: "G8VN5idaQDX6" }), "https://www.petrapay.xyz/l/G8VN5idaQDX6");
});

test("amount is passed to links", () => {
  assert.equal(checkoutUrl({ paymentId: "abc123", amount: 25.5 }), "https://www.petrapay.xyz/l/abc123?amount=25.5");
});

test("checkouts open /pay/<id> and ignore amount", () => {
  assert.equal(checkoutUrl({ paymentId: "abc123", type: "checkout", amount: "9" }), "https://www.petrapay.xyz/pay/abc123");
});

test("custom base url", () => {
  assert.equal(checkoutUrl({ paymentId: "abc123", baseUrl: "https://pay.example.com/" }), "https://pay.example.com/l/abc123");
});

test("rejects unsafe ids", () => {
  assert.throws(() => checkoutUrl({ paymentId: "../admin" }));
  assert.throws(() => checkoutUrl({ paymentId: "" }));
});
