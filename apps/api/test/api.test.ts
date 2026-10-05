import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.ts";
import { prisma } from "../src/db.ts";
import { publicId } from "../src/lib/ids.ts";
import { sumLineItems } from "../src/services/invoices.ts";
import { recomputeInvoice } from "../src/services/swaps.ts";
import { createHmac } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { deliverDueWebhooks, isBlockedAddress } from "../src/services/webhooks.ts";
import { expireCheckouts } from "../src/worker.ts";

// Mainnet unified addresses from the official ZIP-316 test vectors.
const vectors: { ua: string; orchard: boolean; transparent: boolean; unknown: number | null }[] = JSON.parse(
  readFileSync(new URL("../../../packages/shared/test/ua-vectors.json", import.meta.url), "utf8"),
);
const ORCHARD = vectors.filter((v) => v.orchard && v.unknown === null).map((v) => v.ua);

let app: FastifyInstance;

before(async () => {
  app = await buildApp({ logger: false });
});

after(async () => {
  await app.close();
  await prisma.$disconnect();
});

/** Signs in with a fresh ed25519 key and returns a cookie-carrying request helper. */
async function signIn() {
  // Each test account signs in from its own address, as real users would; auth is rate limited per IP.
  const ip = { "x-forwarded-for": `198.51.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` };
  const sk = ed25519.utils.randomSecretKey();
  const publicKey = bytesToHex(ed25519.getPublicKey(sk));
  const challenge = (await app.inject({ method: "POST", url: "/auth/challenge", headers: ip })).json() as { nonce: string; message: string };
  const signature = bytesToHex(ed25519.sign(new TextEncoder().encode(challenge.message), sk));
  const res = await app.inject({ method: "POST", url: "/auth/verify", payload: { publicKey, signature, nonce: challenge.nonce }, headers: ip });
  assert.equal(res.statusCode, 200);
  const cookie = res.cookies.find((c) => c.name === "pp_session");
  assert.ok(cookie, "session cookie set");
  const call = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object, cookies: { pp_session: cookie.value } });
  return { publicKey, sk, challenge, signature, call };
}

const invoiceBody = {
  title: "Logo",
  currency: "USD" as const,
  lineItems: [{ description: "Concepts", quantity: 1, unitAmount: "150" }],
};

describe("helpers", () => {
  test("sumLineItems handles fractional quantities without float drift", () => {
    assert.equal(
      sumLineItems(
        [
          { description: "a", quantity: 2.5, unitAmount: "60" },
          { description: "b", quantity: 1, unitAmount: "0.1" },
        ],
        "USD",
      ),
      "150.10",
    );
    assert.equal(sumLineItems([{ description: "a", quantity: 3, unitAmount: "0.1" }], "ZEC"), "0.30000000");
  });

  test("publicId is url-safe and unique", () => {
    const ids = new Set(Array.from({ length: 500 }, () => publicId()));
    assert.equal(ids.size, 500);
    for (const id of ids) assert.match(id, /^[2-9a-zA-Z]{12}$/);
  });
});

describe("auth", () => {
  test("anonymous session is null, not an error", async () => {
    const res = await app.inject({ method: "GET", url: "/session" });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { me: null });
  });

  test("a challenge can't be replayed", async () => {
    const { publicKey, challenge, signature } = await signIn();
    const replay = await app.inject({ method: "POST", url: "/auth/verify", payload: { publicKey, signature, nonce: challenge.nonce } });
    assert.equal(replay.statusCode, 401);
  });

  test("a signature from another key is rejected", async () => {
    const challenge = (await app.inject({ method: "POST", url: "/auth/challenge" })).json() as { nonce: string; message: string };
    const signer = ed25519.utils.randomSecretKey();
    const claimed = bytesToHex(ed25519.getPublicKey(ed25519.utils.randomSecretKey()));
    const signature = bytesToHex(ed25519.sign(new TextEncoder().encode(challenge.message), signer));
    const res = await app.inject({ method: "POST", url: "/auth/verify", payload: { publicKey: claimed, signature, nonce: challenge.nonce } });
    assert.equal(res.statusCode, 401);
  });

  test("protected routes require a session", async () => {
    assert.equal((await app.inject({ method: "GET", url: "/invoices" })).statusCode, 401);
  });
});

describe("address pool and invoices", () => {
  test("rejects transparent addresses and invoices without a pool", async () => {
    const { call } = await signIn();
    const t = await call("POST", "/addresses", { address: "t1LnFUFV3qJQd9n7DCpJZ3sUhpX8bzsbFFZ" });
    assert.equal(t.statusCode, 400);
    assert.match(t.json().error, /Transparent/);
    const inv = await call("POST", "/invoices", invoiceBody);
    assert.equal(inv.statusCode, 400);
  });

  test("each invoice takes a fresh address, then falls back to the default", async () => {
    const { call } = await signIn();
    const added = await call("POST", "/addresses", { addresses: ORCHARD.slice(0, 2) });
    assert.deepEqual(added.json(), { added: 2, skipped: 0 });

    const a = (await call("POST", "/invoices", invoiceBody)).json();
    const b = (await call("POST", "/invoices", invoiceBody)).json();
    const c = (await call("POST", "/invoices", invoiceBody)).json();
    // The default address is saved for last, so the first two invoices get distinct addresses.
    assert.notEqual(a.settlementAddress, b.settlementAddress);
    assert.equal(a.addressReused, false);
    assert.equal(b.addressReused, false);
    // Pool exhausted: reuse the default and flag it.
    assert.equal(c.addressReused, true);
    assert.deepEqual([a.number, b.number, c.number], [1, 2, 3]);

    const me = (await call("GET", "/me")).json();
    assert.equal(me.freshAddresses, 0);
  });

  test("the public view never exposes the private client note", async () => {
    const { call } = await signIn();
    await call("POST", "/addresses", { address: ORCHARD[0] });
    const inv = (await call("POST", "/invoices", { ...invoiceBody, clientLabel: "enc1:secret-client" })).json();
    const pub = await app.inject({ method: "GET", url: `/public/invoices/${inv.id}` });
    assert.equal(pub.statusCode, 200);
    assert.ok(!JSON.stringify(pub.json()).includes("secret-client"));
  });

  test("invoices are scoped to their creator", async () => {
    const alice = await signIn();
    const bob = await signIn();
    await alice.call("POST", "/addresses", { address: ORCHARD[0] });
    const inv = (await alice.call("POST", "/invoices", invoiceBody)).json();
    assert.equal((await bob.call("GET", `/invoices/${inv.id}`)).statusCode, 404);
    assert.equal((await bob.call("POST", `/invoices/${inv.id}/cancel`)).statusCode, 404);
  });
});

describe("settlement state", () => {
  async function invoiceWithSwaps(statuses: string[]) {
    const { call } = await signIn();
    await call("POST", "/addresses", { address: ORCHARD[0] });
    const inv = (await call("POST", "/invoices", invoiceBody)).json();
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    for (const [i, status] of statuses.entries()) {
      await prisma.swap.create({
        data: {
          kind: "INVOICE_PAYMENT",
          creatorId: invoice.creatorId,
          invoiceId: invoice.id,
          swapType: "EXACT_OUTPUT",
          originAsset: "nep141:sol.omft.near",
          destinationAsset: "nep141:zec.omft.near",
          amountIn: "1000",
          amountInFormatted: "0.000001",
          amountOut: "10000000",
          amountOutFormatted: "0.1",
          amountOutUsd: "150",
          recipient: ORCHARD[0]!,
          refundTo: "refund",
          depositAddress: `dep-${invoice.id}-${i}`,
          deadline: new Date(Date.now() + 3_600_000),
          inactiveAt: new Date(Date.now() + 86_400_000),
          confidentiality: "public",
          correlationId: "test",
          quoteResponse: {},
          status: status as never,
          settledAt: status === "SUCCESS" ? new Date() : null,
        },
      });
    }
    await recomputeInvoice(invoice.id);
    return { call, invoice: await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }) };
  }

  test("a detected deposit moves the invoice to PROCESSING", async () => {
    const { invoice } = await invoiceWithSwaps(["PENDING_DEPOSIT", "PROCESSING"]);
    assert.equal(invoice.status, "PROCESSING");
  });

  test("a refund puts the invoice back to OPEN", async () => {
    const { invoice } = await invoiceWithSwaps(["REFUNDED"]);
    assert.equal(invoice.status, "OPEN");
  });

  test("settled swaps mark it PAID and sum what arrived", async () => {
    const { invoice } = await invoiceWithSwaps(["SUCCESS", "SUCCESS", "FAILED"]);
    assert.equal(invoice.status, "PAID");
    assert.equal(invoice.receivedZats, 20_000_000n);
    assert.equal(invoice.receivedUsd?.toString(), "300");
    assert.ok(invoice.paidAt);
  });

  test("money that arrives on a cancelled invoice still marks it paid", async () => {
    const { call } = await signIn();
    await call("POST", "/addresses", { address: ORCHARD[0] });
    const inv = (await call("POST", "/invoices", invoiceBody)).json();
    assert.equal((await call("POST", `/invoices/${inv.id}/cancel`)).json().status, "CANCELLED");
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    await prisma.swap.create({
      data: {
        kind: "INVOICE_PAYMENT",
        creatorId: invoice.creatorId,
        invoiceId: invoice.id,
        swapType: "EXACT_OUTPUT",
        originAsset: "nep141:sol.omft.near",
        destinationAsset: "nep141:zec.omft.near",
        amountIn: "1",
        amountInFormatted: "0",
        amountOut: "5000000",
        amountOutFormatted: "0.05",
        recipient: ORCHARD[0]!,
        refundTo: "refund",
        depositAddress: `dep-${invoice.id}-late`,
        deadline: new Date(),
        inactiveAt: new Date(),
        confidentiality: "public",
        correlationId: "test",
        quoteResponse: {},
        status: "SUCCESS",
        settledAt: new Date(),
      },
    });
    await recomputeInvoice(invoice.id);
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    assert.equal(after.status, "PAID");
  });

  test("cancelling is blocked while a payment is in flight", async () => {
    const { call, invoice } = await invoiceWithSwaps(["KNOWN_DEPOSIT_TX"]);
    const res = await call("POST", `/invoices/${invoice.id}/cancel`);
    assert.equal(res.statusCode, 409);
  });
});

describe("payment links", () => {
  const boxKey = "ab".repeat(32);
  const fields = [
    { id: "email", label: "Email", type: "email", required: true },
    { id: "size", label: "Size", type: "select", required: false, options: ["S", "M", "L"] },
  ];

  async function creatorWithLink(link: Record<string, unknown>) {
    const creator = await signIn();
    await creator.call("POST", "/addresses", { addresses: ORCHARD.slice(0, 2) });
    assert.equal((await creator.call("PUT", "/me/box", { boxPublicKey: boxKey })).statusCode, 200);
    const res = await creator.call("POST", "/links", { title: "Sticker pack", currency: "ZEC", ...link });
    assert.equal(res.statusCode, 201, res.body);
    return { ...creator, link: res.json() };
  }

  const checkout = (id: string, payload: Record<string, unknown>) => app.inject({ method: "POST", url: `/public/links/${id}/checkout`, payload });

  test("collecting fields needs an encryption key on file", async () => {
    const { call } = await signIn();
    await call("POST", "/addresses", { address: ORCHARD[0] });
    const res = await call("POST", "/links", { title: "Tee", currency: "USD", amountType: "FIXED", amount: "25", fields });
    assert.equal(res.statusCode, 400);
    assert.match(res.json().error, /encrypted responses/);
  });

  test("fixed links validate the price and field definitions", async () => {
    const { call } = await signIn();
    await call("POST", "/addresses", { address: ORCHARD[0] });
    assert.equal((await call("POST", "/links", { title: "Tee", currency: "USD", amountType: "FIXED" })).statusCode, 400);
    assert.equal((await call("POST", "/links", { title: "Tee", currency: "USD", amountType: "FIXED", amount: "0.50" })).statusCode, 400);
    assert.equal((await call("POST", "/links", { title: "Tee", currency: "USD", amountType: "FIXED", amount: "10.123" })).statusCode, 400);
    const badSelect = await call("POST", "/links", {
      title: "Tee",
      currency: "USD",
      amountType: "FIXED",
      amount: "10",
      fields: [{ id: "size", label: "Size", type: "select", required: true, options: ["S"] }],
    });
    assert.equal(badSelect.statusCode, 400);
  });

  test("a payer checkout creates a link payment with sealed responses", async () => {
    const { call, link } = await creatorWithLink({ amountType: "FIXED", amount: "0.5", fields });

    const pub = (await app.inject({ method: "GET", url: `/public/links/${link.id}` })).json();
    assert.equal(pub.boxPublicKey, boxKey);
    assert.equal(pub.fields.length, 2);

    assert.equal((await checkout(link.id, { amount: "0.4", method: "zec", responses: "box1:x" })).statusCode, 400);
    assert.equal((await checkout(link.id, { amount: "0.5", method: "zec" })).statusCode, 400);
    assert.equal((await checkout(link.id, { amount: "0.5", method: "zec", responses: '{"email":"a@b.c"}' })).statusCode, 400);

    const ok = await checkout(link.id, { amount: "0.5", method: "zec", responses: "box1:sealed" });
    assert.equal(ok.statusCode, 201, ok.body);
    const { invoice, swap } = ok.json();
    assert.equal(swap, null);
    assert.equal(invoice.amount, "0.5");
    assert.ok(!JSON.stringify(invoice).includes("box1:"), "responses never go back to the payer");

    // Link payments live under the link, not the invoice list.
    assert.equal((await call("GET", "/invoices")).json().length, 0);
    const detail = (await call("GET", `/links/${link.id}`)).json();
    assert.equal(detail.stats.started, 1);
    assert.equal(detail.payments[0].responses, "box1:sealed");
    assert.deepEqual(detail.payments[0].link, { id: link.id, title: "Sticker pack" });
  });

  test("custom amounts respect bounds, and paused links stop taking payments", async () => {
    const { call, link } = await creatorWithLink({ amountType: "CUSTOM", minAmount: "0.01", maxAmount: "2", presets: ["0.1", "0.5"] });
    assert.equal((await checkout(link.id, { amount: "0.005", method: "zec" })).statusCode, 400);
    assert.equal((await checkout(link.id, { amount: "3", method: "zec" })).statusCode, 400);
    assert.equal((await checkout(link.id, { amount: "1.25", method: "zec" })).statusCode, 201);

    const paused = await call("PATCH", `/links/${link.id}`, { active: false });
    assert.equal(paused.json().active, false);
    assert.equal((await checkout(link.id, { amount: "1", method: "zec" })).statusCode, 409);
  });

  test("links are scoped to their creator", async () => {
    const { link } = await creatorWithLink({ amountType: "FIXED", amount: "1" });
    const other = await signIn();
    assert.equal((await other.call("GET", `/links/${link.id}`)).statusCode, 404);
    assert.equal((await other.call("PATCH", `/links/${link.id}`, { active: false })).statusCode, 404);
  });
});

describe("editing invoices and client details", () => {
  const client = { clientName: "Acme Studio", clientEmail: "billing@acme.test" };

  async function openInvoice(extra: Record<string, unknown> = {}) {
    const creator = await signIn();
    await creator.call("POST", "/addresses", { address: ORCHARD[0] });
    const inv = (await creator.call("POST", "/invoices", { ...invoiceBody, ...client, ...extra })).json();
    return { ...creator, inv };
  }

  const pendingSwap = (invoiceId: string, creatorId: string, deadline: Date) =>
    prisma.swap.create({
      data: {
        kind: "INVOICE_PAYMENT",
        creatorId,
        invoiceId,
        swapType: "EXACT_OUTPUT",
        originAsset: "nep141:sol.omft.near",
        destinationAsset: "nep141:zec.omft.near",
        amountIn: "1",
        amountInFormatted: "1",
        amountOut: "10000000",
        amountOutFormatted: "0.1",
        recipient: ORCHARD[0]!,
        refundTo: "refund",
        depositAddress: `dep-${invoiceId}-${deadline.getTime()}`,
        deadline,
        inactiveAt: new Date(deadline.getTime() + 86_400_000),
        confidentiality: "public",
        correlationId: "test",
        quoteResponse: {},
      },
    });

  test("client details are optional and shown to the payer", async () => {
    const { inv, call } = await openInvoice();
    assert.equal(inv.clientName, "Acme Studio");
    assert.equal(inv.clientEmail, "billing@acme.test");
    const pub = (await app.inject({ method: "GET", url: `/public/invoices/${inv.id}` })).json();
    assert.equal(pub.clientName, "Acme Studio");
    assert.equal(pub.clientEmail, "billing@acme.test");

    // Blank fields from the form mean "not set".
    const bare = (await call("POST", "/invoices", { ...invoiceBody, clientName: "  ", clientEmail: "" })).json();
    assert.equal(bare.clientName, null);
    assert.equal(bare.clientEmail, null);
    assert.equal((await call("POST", "/invoices", { ...invoiceBody, clientEmail: "not-an-email" })).statusCode, 400);
  });

  test("an open invoice can be edited, and totals are recomputed", async () => {
    const { call, inv } = await openInvoice();
    const res = await call("PUT", `/invoices/${inv.id}`, {
      title: "Logo + icons",
      currency: "USD",
      lineItems: [
        { description: "Logo", quantity: 1, unitAmount: "150" },
        { description: "Icon set", quantity: 2, unitAmount: "40" },
      ],
      dueDate: "2026-12-01T23:59:59.000Z",
    });
    assert.equal(res.statusCode, 200, res.body);
    const edited = res.json();
    assert.equal(edited.title, "Logo + icons");
    assert.equal(edited.amount, "230");
    assert.ok(edited.editedAt);
    // Edits replace the editable fields, so leaving the client out clears it.
    assert.equal(edited.clientName, null);
    const renamed = (await call("PUT", `/invoices/${inv.id}`, { ...invoiceBody, clientName: "Acme Ltd" })).json();
    assert.equal(renamed.clientName, "Acme Ltd");
    assert.equal(renamed.clientEmail, null);
  });

  test("the total is frozen while a client holds a live quote", async () => {
    const { call, inv } = await openInvoice();
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    await pendingSwap(inv.id, invoice.creatorId, new Date(Date.now() + 3_600_000));

    const pricier = await call("PUT", `/invoices/${inv.id}`, { ...invoiceBody, lineItems: [{ description: "Concepts", quantity: 1, unitAmount: "200" }] });
    assert.equal(pricier.statusCode, 409);
    assert.ok(pricier.json().details.lockedUntil);
    // Everything but the total can still change.
    const renamed = await call("PUT", `/invoices/${inv.id}`, { ...invoiceBody, title: "Logo concepts" });
    assert.equal(renamed.statusCode, 200, renamed.body);
  });

  test("an expired quote doesn't block edits", async () => {
    const { call, inv } = await openInvoice();
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
    await pendingSwap(inv.id, invoice.creatorId, new Date(Date.now() - 60_000));
    const res = await call("PUT", `/invoices/${inv.id}`, { ...invoiceBody, lineItems: [{ description: "Concepts", quantity: 1, unitAmount: "200" }] });
    assert.equal(res.statusCode, 200, res.body);
  });

  test("paid, cancelled and link invoices can't be edited", async () => {
    const { call, inv } = await openInvoice();
    await call("POST", `/invoices/${inv.id}/cancel`);
    assert.equal((await call("PUT", `/invoices/${inv.id}`, invoiceBody)).statusCode, 409);

    const second = await openInvoice();
    await second.call("POST", `/invoices/${second.inv.id}/mark-paid`);
    assert.equal((await second.call("PUT", `/invoices/${second.inv.id}`, invoiceBody)).statusCode, 409);

    const other = await signIn();
    assert.equal((await other.call("PUT", `/invoices/${second.inv.id}`, invoiceBody)).statusCode, 404);
  });
});

describe("merchant API", () => {
  /** A merchant with an address pool and a secret key; `v1` calls the public API with it. */
  async function merchant() {
    const creator = await signIn();
    await creator.call("POST", "/addresses", { addresses: ORCHARD.slice(0, 3) });
    const created = await creator.call("POST", "/api-keys", { name: "Store backend" });
    assert.equal(created.statusCode, 201, created.body);
    const { secret, key } = created.json();
    const v1 = (method: "GET" | "POST", url: string, payload?: unknown, headers: Record<string, string> = {}) =>
      app.inject({ method, url: `/v1${url}`, payload: payload as object, headers: { authorization: `Bearer ${secret}`, ...headers } });
    return { ...creator, secret, key, v1 };
  }

  const checkoutBody = { currency: "USD", amount: "49.99", title: "Order #1001", reference: "order_1001", metadata: { cart: "abc" } };

  test("keys are shown once, hashed at rest, and revocable", async () => {
    const m = await merchant();
    assert.match(m.secret, /^pp_sk_[A-Za-z0-9_-]{43}$/);
    const list = (await m.call("GET", "/api-keys")).json();
    assert.equal(list.length, 1);
    assert.ok(!JSON.stringify(list).includes(m.secret), "the secret is never listed");
    const stored = await prisma.apiKey.findUniqueOrThrow({ where: { id: m.key.id } });
    assert.notEqual(stored.hash, m.secret);

    assert.equal((await m.v1("GET", "/checkouts")).statusCode, 200);
    await m.call("DELETE", `/api-keys/${m.key.id}`);
    const revoked = await m.v1("GET", "/checkouts");
    assert.equal(revoked.statusCode, 401);
    assert.equal(revoked.json().error.type, "authentication_error");
  });

  test("requests without a valid key are rejected", async () => {
    const none = await app.inject({ method: "GET", url: "/v1/checkouts" });
    assert.equal(none.statusCode, 401);
    assert.equal(none.json().error.type, "authentication_error");
    const bogus = await app.inject({ method: "GET", url: "/v1/checkouts", headers: { authorization: `Bearer pp_sk_${"x".repeat(43)}` } });
    assert.equal(bogus.statusCode, 401);
  });

  test("creates a checkout with a hosted URL, expiry and merchant data", async () => {
    const m = await merchant();
    const res = await m.v1("POST", "/checkouts", { ...checkoutBody, customer: { email: "buyer@example.com" }, success_url: "https://shop.test/thanks?c={CHECKOUT_ID}" });
    assert.equal(res.statusCode, 201, res.body);
    const c = res.json();
    assert.equal(c.object, "checkout");
    assert.equal(c.status, "open");
    assert.equal(c.amount, "49.99");
    assert.equal(c.source, "api");
    assert.equal(c.reference, "order_1001");
    assert.deepEqual(c.metadata, { cart: "abc" });
    assert.equal(c.customer.email, "buyer@example.com");
    assert.match(c.url, new RegExp(`/pay/${c.id}$`));
    const hours = (new Date(c.expires_at).getTime() - Date.now()) / 3_600_000;
    assert.ok(hours > 23.9 && hours <= 24, "expires in 24 hours by default");

    // The hosted page knows where to send the customer.
    const pub = (await app.inject({ method: "GET", url: `/public/invoices/${c.id}` })).json();
    assert.equal(pub.successUrl, "https://shop.test/thanks?c={CHECKOUT_ID}");

    const lines = await m.v1("POST", "/checkouts", {
      currency: "USD",
      title: "Cart",
      line_items: [
        { description: "Mug", quantity: 2, unit_amount: "12.50" },
        { description: "Poster", unit_amount: "20" },
      ],
    });
    assert.equal(lines.json().amount, "45");
  });

  test("validation errors name the parameter", async () => {
    const m = await merchant();
    const both = await m.v1("POST", "/checkouts", { ...checkoutBody, line_items: [{ description: "x", unit_amount: "1" }] });
    assert.equal(both.statusCode, 400);
    assert.equal(both.json().error.type, "invalid_request_error");
    assert.equal(both.json().error.param, "amount");
    const badUrl = await m.v1("POST", "/checkouts", { ...checkoutBody, success_url: "javascript:alert(1)" });
    assert.equal(badUrl.json().error.param, "success_url");
    assert.equal((await m.v1("POST", "/checkouts", { ...checkoutBody, amount: "0.50" })).statusCode, 400);
    assert.equal((await m.v1("POST", "/checkouts", { ...checkoutBody, amount: "10.001" })).statusCode, 400);
    assert.equal((await m.v1("GET", "/nope")).statusCode, 404);
  });

  test("Idempotency-Key replays the first response", async () => {
    const m = await merchant();
    const headers = { "idempotency-key": "order_1001_attempt" };
    const first = await m.v1("POST", "/checkouts", checkoutBody, headers);
    const again = await m.v1("POST", "/checkouts", checkoutBody, headers);
    assert.equal(again.statusCode, 201);
    assert.equal(again.json().id, first.json().id);
    assert.equal(again.headers["idempotent-replayed"], "true");
    const different = await m.v1("POST", "/checkouts", { ...checkoutBody, amount: "10" }, headers);
    assert.equal(different.statusCode, 400);
    assert.equal(different.json().error.type, "idempotency_error");
    assert.equal(await prisma.invoice.count({ where: { reference: "order_1001", creator: { apiKeys: { some: { id: m.key.id } } } } }), 1);
  });

  test("lists paginate with starting_after and filter by reference", async () => {
    const m = await merchant();
    for (const ref of ["a", "b", "c"]) await m.v1("POST", "/checkouts", { ...checkoutBody, reference: ref });
    const page1 = (await m.v1("GET", "/checkouts?limit=2")).json();
    assert.equal(page1.object, "list");
    assert.equal(page1.data.length, 2);
    assert.equal(page1.has_more, true);
    const page2 = (await m.v1("GET", `/checkouts?limit=2&starting_after=${page1.data[1].id}`)).json();
    assert.equal(page2.data.length, 1);
    assert.equal(page2.has_more, false);
    assert.equal((await m.v1("GET", "/checkouts?reference=b")).json().data[0].reference, "b");

    // Another merchant's ids are invisible.
    const other = await merchant();
    assert.equal((await other.v1("GET", `/checkouts/${page1.data[0].id}`)).statusCode, 404);
  });

  test("checkouts expire, then refuse new quotes", async () => {
    const m = await merchant();
    const c = (await m.v1("POST", "/checkouts", { ...checkoutBody, expires_in: 300 })).json();
    await prisma.invoice.update({ where: { id: c.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await m.v1("GET", `/checkouts/${c.id}`)).json().status, "expired", "reported expired before the sweep");
    await expireCheckouts({ info: () => undefined });
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: c.id } })).status, "EXPIRED");
    const quote = await app.inject({ method: "POST", url: `/public/invoices/${c.id}/quote`, payload: { originAsset: "nep141:sol.omft.near", dry: true } });
    assert.equal(quote.statusCode, 409);
  });

  test("payment links can be created and paused through the API", async () => {
    const m = await merchant();
    const res = await m.v1("POST", "/payment_links", { title: "Tip jar", currency: "USD", amount_type: "custom", min_amount: "2", presets: ["5", "10"] });
    assert.equal(res.statusCode, 201, res.body);
    const link = res.json();
    assert.equal(link.object, "payment_link");
    assert.match(link.url, new RegExp(`/l/${link.id}$`));
    assert.equal((await m.v1("POST", "/payment_links", { title: "Tee", currency: "USD", amount_type: "fixed" })).json().error.param, "amount");
    assert.equal((await m.v1("POST", `/payment_links/${link.id}`, { active: false })).json().active, false);
  });

  test("private and loopback webhook targets are blocked", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.5", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      assert.equal(isBlockedAddress(ip), true, ip);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isBlockedAddress(ip), false, ip);
  });

  describe("webhooks", () => {
    let server: Server;
    let url: string;
    let status = 200;
    const received: { headers: IncomingMessage["headers"]; body: string }[] = [];

    before(async () => {
      server = createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          received.push({ headers: req.headers, body });
          res.writeHead(status).end(status === 200 ? "ok" : "nope");
        });
      });
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hooks`;
    });
    after(() => new Promise<void>((r) => server.close(() => r())));

    /** Waits for fire-and-forget events to be queued, then delivers them. */
    async function flush(endpointId: string, count: number) {
      for (let i = 0; i < 50; i++) {
        if ((await prisma.webhookDelivery.count({ where: { endpointId } })) >= count) break;
        await new Promise((r) => setTimeout(r, 20));
      }
      await deliverDueWebhooks();
    }

    test("delivers subscribed events, signed with the endpoint secret", async () => {
      const m = await merchant();
      const ep = (await m.call("POST", "/webhooks", { url, events: ["checkout.paid", "checkout.cancelled"] })).json();
      assert.match(ep.secret, /^whsec_/);

      const c = (await m.v1("POST", "/checkouts", checkoutBody)).json();
      await m.call("POST", `/invoices/${c.id}/mark-paid`);
      received.length = 0;
      await flush(ep.id, 1);

      assert.equal(received.length, 1, "checkout.created isn't subscribed, checkout.paid is");
      const { headers, body } = received[0]!;
      const event = JSON.parse(body);
      assert.equal(event.type, "checkout.paid");
      assert.equal(event.data.object.id, c.id);
      assert.equal(event.data.object.status, "paid");
      assert.equal(event.data.object.reference, "order_1001");
      assert.equal(headers["petrapay-event-id"], event.id);

      const [t, v1] = String(headers["petrapay-signature"]).split(",").map((p) => p.split("=")[1]);
      assert.equal(v1, createHmac("sha256", ep.secret).update(`${t}.${body}`).digest("hex"));
      assert.ok(Math.abs(Date.now() / 1000 - Number(t)) < 60);

      const deliveries = (await m.call("GET", `/webhooks/${ep.id}/deliveries`)).json();
      assert.equal(deliveries[0].status, "SUCCEEDED");
      assert.equal(deliveries[0].responseStatus, 200);
    });

    test("failed deliveries are retried with backoff, and can be resent", async () => {
      const m = await merchant();
      const ep = (await m.call("POST", "/webhooks", { url, events: ["*"] })).json();
      status = 500;
      const c = (await m.v1("POST", "/checkouts", checkoutBody)).json();
      await flush(ep.id, 1);
      const [failed] = (await m.call("GET", `/webhooks/${ep.id}/deliveries`)).json();
      assert.equal(failed.status, "PENDING");
      assert.equal(failed.attempts, 1);
      assert.equal(failed.responseStatus, 500);
      const wait = new Date(failed.nextAttemptAt).getTime() - Date.now();
      assert.ok(wait > 50_000 && wait <= 60_000, "next try in about a minute");

      status = 200;
      const retried = (await m.call("POST", `/webhooks/${ep.id}/deliveries/${failed.id}/retry`)).json();
      assert.equal(retried.status, "SUCCEEDED");
      assert.equal(retried.attempts, 2);
      assert.equal(JSON.parse(received.at(-1)!.body).data.object.id, c.id);
    });

    test("test events reach only the chosen endpoint", async () => {
      const m = await merchant();
      const ep = (await m.call("POST", "/webhooks", { url, events: ["checkout.paid"] })).json();
      received.length = 0;
      const result = (await m.call("POST", `/webhooks/${ep.id}/test`)).json();
      assert.equal(result.status, "SUCCEEDED");
      assert.equal(result.eventType, "ping");
      assert.equal(JSON.parse(received[0]!.body).type, "ping");
    });

    test("endpoints are scoped to their merchant", async () => {
      const m = await merchant();
      const ep = (await m.call("POST", "/webhooks", { url, events: ["*"] })).json();
      const other = await signIn();
      assert.equal((await other.call("GET", `/webhooks/${ep.id}`)).statusCode, 404);
      assert.equal((await other.call("POST", `/webhooks/${ep.id}/test`)).statusCode, 404);
    });
  });
});
