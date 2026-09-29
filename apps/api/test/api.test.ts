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
  const sk = ed25519.utils.randomSecretKey();
  const publicKey = bytesToHex(ed25519.getPublicKey(sk));
  const challenge = (await app.inject({ method: "POST", url: "/auth/challenge" })).json() as { nonce: string; message: string };
  const signature = bytesToHex(ed25519.sign(new TextEncoder().encode(challenge.message), sk));
  const res = await app.inject({ method: "POST", url: "/auth/verify", payload: { publicKey, signature, nonce: challenge.nonce } });
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
  const billTo = "sk1:ciphertext";
  const billToKey = "enc1:wrapped-key";

  async function openInvoice(extra: Record<string, unknown> = {}) {
    const creator = await signIn();
    await creator.call("POST", "/addresses", { address: ORCHARD[0] });
    const inv = (await creator.call("POST", "/invoices", { ...invoiceBody, billTo, billToKey, ...extra })).json();
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

  test("client details are stored sealed and reach the payer only as ciphertext", async () => {
    const { inv } = await openInvoice();
    assert.equal(inv.billTo, billTo);
    assert.equal(inv.billToKey, billToKey);
    const pub = (await app.inject({ method: "GET", url: `/public/invoices/${inv.id}` })).json();
    assert.equal(pub.billTo, billTo);
    assert.ok(!JSON.stringify(pub).includes("wrapped-key"), "the wrapped key stays with the creator");
  });

  test("plaintext client details are rejected", async () => {
    const { call } = await signIn();
    await call("POST", "/addresses", { address: ORCHARD[0] });
    const res = await call("POST", "/invoices", { ...invoiceBody, billTo: '{"name":"Acme"}', billToKey });
    assert.equal(res.statusCode, 400);
    assert.equal((await call("POST", "/invoices", { ...invoiceBody, billTo })).statusCode, 400, "details without their key");
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
    // Leaving the client fields out keeps them; null clears them.
    assert.equal(edited.billTo, billTo);
    const cleared = (await call("PUT", `/invoices/${inv.id}`, { ...invoiceBody, billTo: null, billToKey: null })).json();
    assert.equal(cleared.billTo, null);
    assert.equal(cleared.billToKey, null);
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
