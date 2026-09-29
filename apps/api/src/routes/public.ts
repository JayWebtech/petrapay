import { depositTxSchema, payQuoteSchema } from "@petrapay/shared";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.ts";
import { HttpError, notFound, parseBody } from "../lib/http.ts";
import { toPublicInvoiceDTO } from "../services/invoices.ts";
import { confidentiality, getTokens, submitDepositTx } from "../services/oneclick.ts";
import { quoteInvoicePayment } from "../services/payments.ts";
import { isTerminal, refreshSwap, toSwapDTO } from "../services/swaps.ts";
/** Payment status is refreshed from 1Click on read if the worker hasn't touched it recently. */
const STALE_MS = 4_000;

async function loadPayableInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { address: true, creator: true } });
  if (!invoice) throw notFound("Invoice not found");
  return invoice;
}

export async function publicRoutes(app: FastifyInstance) {
  app.get("/tokens", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=60");
    const tokens = await getTokens();
    return tokens.filter((t) => t.priceUsd > 0);
  });

  app.get("/config", async () => ({ confidentiality: confidentiality() }));

  app.get<{ Params: { id: string } }>("/public/invoices/:id", async (req) => {
    const invoice = await loadPayableInvoice(req.params.id);
    return toPublicInvoiceDTO(invoice);
  });

  app.post<{ Params: { id: string } }>(
    "/public/invoices/:id/quote",
    { config: { rateLimit: { max: 40, timeWindow: "1 minute" } } },
    async (req) => {
      const body = parseBody(payQuoteSchema, req);
      const invoice = await loadPayableInvoice(req.params.id);
      return quoteInvoicePayment(invoice, body);
    },
  );

  app.get<{ Params: { id: string; swapId: string } }>("/public/invoices/:id/payments/:swapId", async (req) => {
    let swap = await prisma.swap.findFirst({ where: { id: req.params.swapId, invoiceId: req.params.id } });
    if (!swap) throw notFound("Payment not found");
    if (!isTerminal(swap.status) && (!swap.lastCheckedAt || Date.now() - swap.lastCheckedAt.getTime() > STALE_MS)) {
      swap = await refreshSwap(swap);
    }
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: req.params.id }, select: { status: true } });
    return { swap: await toSwapDTO(swap), invoiceStatus: invoice.status };
  });

  app.post<{ Params: { id: string; swapId: string } }>(
    "/public/invoices/:id/payments/:swapId/deposit-tx",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req) => {
      const { txHash } = parseBody(depositTxSchema, req);
      const swap = await prisma.swap.findFirst({ where: { id: req.params.swapId, invoiceId: req.params.id } });
      if (!swap) throw notFound("Payment not found");
      await submitDepositTx(swap.depositAddress, txHash, swap.depositMemo);
      const updated = await prisma.swap.update({ where: { id: swap.id }, data: { depositTxHash: txHash } });
      return toSwapDTO(await refreshSwap(updated));
    },
  );

  /** The payer says they sent ZEC directly. The creator confirms in their wallet and marks it paid. */
  app.post<{ Params: { id: string } }>(
    "/public/invoices/:id/zec-sent",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req) => {
      const invoice = await loadPayableInvoice(req.params.id);
      if (invoice.status !== "OPEN") throw new HttpError(409, "Invoice is not open");
      await prisma.invoice.update({ where: { id: invoice.id }, data: { payerMarkedPaidAt: new Date() } });
      return { ok: true };
    },
  );
}
