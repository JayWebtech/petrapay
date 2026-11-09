import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import QRCode from "qrcode";
import { prisma, type Invoice, type PosDevice, type Swap } from "../db.ts";
import { env } from "../env.ts";
import { HttpError, notFound, parseBody } from "../lib/http.ts";
import { randomToken } from "../lib/ids.ts";
import { creatorOf, requireCreator } from "../services/auth.ts";
import { cancelInvoice, createInvoice, invoiceTotal } from "../services/invoices.ts";
import { getToken } from "../services/oneclick.ts";
import { checkoutUrl } from "../services/objects.ts";
import { isTerminal, refreshSwap } from "../services/swaps.ts";
import { emitCheckoutEvent } from "../services/webhooks.ts";

/**
 * Point-of-sale terminals. A merchant pairs a terminal with a one-time code from the dashboard;
 * the terminal then holds its own token, which can only ring up and view its sales. The customer
 * pays by scanning the sale's QR, which opens the regular hosted checkout on their phone.
 */

const TOKEN_PREFIX = "pos_";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60_000;
/** A till sale shouldn't linger: the price was for the customer standing there. */
const SALE_TTL_MS = 15 * 60_000;
const MAX_DEVICES = 20;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

declare module "fastify" {
  interface FastifyRequest {
    posDevice?: PosDevice;
  }
}

const decimal = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Enter an amount")
  .refine((v) => Number(v) > 0, "Enter an amount");

const pairSchema = z.object({ code: z.string().trim().min(4).max(20), deviceName: z.string().trim().min(1).max(60) });
const saleSchema = z.object({
  amount: decimal,
  currency: z.enum(["USD", "ZEC"]),
  note: z.string().trim().max(120).optional(),
});

// ---------- DTOs ----------

export type PosDeviceDTO = { id: string; name: string; testMode: boolean; createdAt: string; lastSeenAt: string | null; sales: number };

const toDeviceDTO = (d: PosDevice & { _count?: { sales: number } }): PosDeviceDTO => ({
  id: d.id,
  name: d.name,
  testMode: d.testMode,
  createdAt: d.createdAt.toISOString(),
  lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
  sales: d._count?.sales ?? 0,
});

/** What the terminal shows and prints. Deliberately small: no addresses, keys or internal ids. */
async function toSaleDTO(invoice: Invoice & { swaps: Swap[] }, withQr = false) {
  const url = checkoutUrl(invoice.id);
  const settled = invoice.swaps.find((s) => s.status === "SUCCESS");
  const moving = invoice.swaps.find((s) => ["KNOWN_DEPOSIT_TX", "PROCESSING"].includes(s.status));
  const via = settled ?? moving;
  const token = via ? await getToken(via.originAsset).catch(() => undefined) : undefined;
  const details = (settled?.swapDetails ?? null) as { originChainTxHashes?: { hash: string }[] } | null;
  const expired = invoice.status === "OPEN" && !!invoice.expiresAt && invoice.expiresAt.getTime() <= Date.now();
  return {
    id: invoice.id,
    number: invoice.number,
    status: (expired ? "EXPIRED" : invoice.status) as Invoice["status"],
    amount: invoice.amount.toString(),
    currency: invoice.currency,
    note: invoice.title,
    testMode: invoice.testMode,
    checkoutUrl: url,
    qrDataUrl: withQr ? await QRCode.toDataURL(url, { margin: 1, width: 520, errorCorrectionLevel: "M" }) : null,
    paidWith: via && token ? { symbol: token.symbol, chain: token.blockchain, amount: via.amountInFormatted } : null,
    received: invoice.receivedZats !== null ? { zec: (Number(invoice.receivedZats) / 1e8).toFixed(8).replace(/\.?0+$/, ""), usd: invoice.receivedUsd?.toString() ?? null } : null,
    customerReportedZec: !!invoice.payerMarkedPaidAt,
    txHash: details?.originChainTxHashes?.[0]?.hash ?? null,
    createdAt: invoice.createdAt.toISOString(),
    expiresAt: invoice.expiresAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
  };
}

// ---------- Dashboard: pairing and devices (session auth) ----------

export async function posDashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireCreator);

  /** A one-time code the merchant types into a terminal. Valid for 10 minutes. */
  app.post("/pos-devices/pairing-code", async (req) => {
    const creator = creatorOf(req);
    const active = await prisma.posDevice.count({ where: { creatorId: creator.id, revokedAt: null } });
    if (active >= MAX_DEVICES) throw new HttpError(400, `You can pair at most ${MAX_DEVICES} terminals. Remove one first.`);
    const raw = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    // Older unused codes stop working: only the code on screen is valid.
    await prisma.posPairingCode.deleteMany({ where: { creatorId: creator.id, usedAt: null } });
    await prisma.posPairingCode.create({ data: { codeHash: sha256(raw), creatorId: creator.id, expiresAt } });
    return { code: `${raw.slice(0, 4)}-${raw.slice(4)}`, expiresAt: expiresAt.toISOString() };
  });

  app.get("/pos-devices", async (req) => {
    const devices = await prisma.posDevice.findMany({
      where: { creatorId: creatorOf(req).id, revokedAt: null },
      include: { _count: { select: { sales: true } } },
      orderBy: { createdAt: "desc" },
    });
    return devices.map(toDeviceDTO);
  });

  /** Test mode: this terminal's sales can be paid with a simulated payment, for trying the flow without funds. */
  app.patch<{ Params: { id: string } }>("/pos-devices/:id", async (req) => {
    const { testMode } = parseBody(z.object({ testMode: z.boolean() }), req);
    const device = await prisma.posDevice.findFirst({ where: { id: req.params.id, creatorId: creatorOf(req).id, revokedAt: null } });
    if (!device) throw notFound("Terminal not found");
    const updated = await prisma.posDevice.update({ where: { id: device.id }, data: { testMode }, include: { _count: { select: { sales: true } } } });
    return toDeviceDTO(updated);
  });

  app.delete<{ Params: { id: string } }>("/pos-devices/:id", async (req) => {
    const device = await prisma.posDevice.findFirst({ where: { id: req.params.id, creatorId: creatorOf(req).id, revokedAt: null } });
    if (!device) throw notFound("Terminal not found");
    await prisma.posDevice.update({ where: { id: device.id }, data: { revokedAt: new Date() } });
    return { removed: true };
  });
}

// ---------- Terminal (device token) ----------

async function requirePosDevice(req: FastifyRequest) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  const token = match?.[1];
  if (!token?.startsWith(TOKEN_PREFIX)) throw new HttpError(401, "This terminal isn't paired");
  const device = await prisma.posDevice.findUnique({ where: { tokenHash: sha256(token) }, include: { creator: true } });
  if (!device || device.revokedAt) throw new HttpError(401, "This terminal was removed from the account");
  req.posDevice = device;
  req.creator = device.creator;
  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 60_000) {
    void prisma.posDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
}

export async function terminalRoutes(app: FastifyInstance) {
  /** Exchanges a pairing code for this terminal's token. Unauthenticated, so tightly rate limited. */
  app.post("/terminal/pair", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const { code, deviceName } = parseBody(pairSchema, req);
    const codeHash = sha256(normalizeCode(code));
    // Claim the code atomically so it can't pair two terminals.
    const claimed = await prisma.posPairingCode.updateMany({
      where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) throw new HttpError(400, "That code is wrong or has expired. Get a new one from your dashboard.");
    const { creatorId } = await prisma.posPairingCode.findUniqueOrThrow({ where: { codeHash } });
    const token = TOKEN_PREFIX + randomToken(32);
    const device = await prisma.posDevice.create({ data: { creatorId, name: deviceName, tokenHash: sha256(token) } });
    reply.status(201);
    return { token, deviceId: device.id };
  });

  app.register(async (paired) => {
    paired.addHook("preHandler", requirePosDevice);

    paired.get("/terminal/me", async (req) => {
      const device = req.posDevice!;
      const creator = creatorOf(req);
      const [fresh, total] = await Promise.all([
        prisma.shieldedAddress.count({ where: { creatorId: creator.id, assignedAt: null } }),
        prisma.shieldedAddress.count({ where: { creatorId: creator.id } }),
      ]);
      return {
        merchantName: creator.displayName ?? "My store",
        deviceName: device.name,
        testMode: device.testMode,
        canAcceptPayments: total > 0,
        freshAddresses: fresh,
        checkoutBase: env.APP_ORIGIN,
      };
    });

    /** Rings up a sale. `Idempotency-Key` makes a retried request return the same sale. */
    paired.post("/terminal/sales", async (req, reply) => {
      const device = req.posDevice!;
      const body = parseBody(saleSchema, req);
      const header = req.headers["idempotency-key"];
      const key = (Array.isArray(header) ? header[0] : header)?.slice(0, 100);
      if (key) {
        const existing = await prisma.invoice.findFirst({
          where: { posDeviceId: device.id, metadata: { path: ["posKey"], equals: key } },
          include: { swaps: true },
        });
        if (existing) return toSaleDTO(existing, true);
      }
      const title = body.note || "In-store payment";
      const lineItems = [{ description: title, quantity: 1, unitAmount: body.amount }];
      const amount = invoiceTotal(lineItems, body.currency);
      const invoice = await createInvoice(device.creatorId, {
        title,
        lineItems,
        currency: body.currency,
        amount,
        source: "POS",
        metadata: key ? { posKey: key } : null,
        expiresAt: new Date(Date.now() + SALE_TTL_MS),
        posDeviceId: device.id,
        testMode: device.testMode,
      });
      void emitCheckoutEvent(invoice.id, "checkout.created");
      reply.status(201);
      return toSaleDTO({ ...invoice, swaps: [] }, true);
    });

    paired.get<{ Querystring: { limit?: string } }>("/terminal/sales", async (req) => {
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
      const sales = await prisma.invoice.findMany({
        where: { posDeviceId: req.posDevice!.id },
        include: { swaps: true },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      return Promise.all(sales.map((s) => toSaleDTO(s)));
    });

    const loadSale = async (req: FastifyRequest, id: string) => {
      const sale = await prisma.invoice.findFirst({ where: { id, posDeviceId: req.posDevice!.id }, include: { swaps: true } });
      if (!sale) throw notFound("Sale not found");
      return sale;
    };

    /** Live status: in-flight payments are refreshed on read so the till updates without waiting for the worker. */
    paired.get<{ Params: { id: string }; Querystring: { qr?: string } }>("/terminal/sales/:id", async (req) => {
      let sale = await loadSale(req, req.params.id);
      const active = sale.swaps.filter((s) => !isTerminal(s.status));
      if (active.length > 0) {
        await Promise.all(active.map((s) => refreshSwap(s).catch(() => undefined)));
        sale = await loadSale(req, req.params.id);
      }
      return toSaleDTO(sale, req.query.qr === "1");
    });

    paired.post<{ Params: { id: string } }>("/terminal/sales/:id/cancel", async (req) => {
      const sale = await loadSale(req, req.params.id);
      await cancelInvoice(sale);
      return toSaleDTO(await loadSale(req, req.params.id));
    });
  });
}

export type PosSaleDTO = Awaited<ReturnType<typeof toSaleDTO>>;
