import { createInvoiceSchema, updateInvoiceSchema, type LineItem } from "@petrapay/shared";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.ts";
import { HttpError, notFound, parseBody } from "../lib/http.ts";
import { creatorOf, requireCreator } from "../services/auth.ts";
import { INVOICE_INCLUDE, createInvoice, sumLineItems, toInvoiceDTO } from "../services/invoices.ts";
import { isTerminal, refreshSwap } from "../services/swaps.ts";

const STATUSES = ["OPEN", "PROCESSING", "PAID", "CANCELLED"] as const;

/** The invoice total for these line items, or a 400 if it's below what the swap route can deliver. */
function invoiceTotal(lineItems: LineItem[], currency: "USD" | "ZEC"): string {
  const amount = sumLineItems(lineItems, currency);
  if (Number(amount) <= 0) throw new HttpError(400, "Invoice total must be greater than zero");
  if (currency === "USD" && Number(amount) < 1) throw new HttpError(400, "USD invoices must be at least $1.00");
  if (currency === "ZEC" && Number(amount) < 0.001) throw new HttpError(400, "ZEC invoices must be at least 0.001 ZEC");
  return amount;
}

export async function invoiceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireCreator);

  app.get<{ Querystring: { status?: string } }>("/invoices", async (req) => {
    const status = STATUSES.find((s) => s === req.query.status);
    const invoices = await prisma.invoice.findMany({
      // Invoices a payer created through a payment link are listed under that link instead.
      where: { creatorId: creatorOf(req).id, linkId: null, ...(status ? { status } : {}) },
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return Promise.all(invoices.map(toInvoiceDTO));
  });

  app.post("/invoices", async (req, reply) => {
    const creator = creatorOf(req);
    const body = parseBody(createInvoiceSchema, req);
    const amount = invoiceTotal(body.lineItems, body.currency);

    const invoice = await createInvoice(creator.id, {
      title: body.title,
      description: body.description,
      clientLabel: body.clientLabel,
      billTo: body.billTo,
      billToKey: body.billToKey,
      lineItems: body.lineItems,
      currency: body.currency,
      amount,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
    });
    reply.status(201);
    return toInvoiceDTO(invoice);
  });

  app.get<{ Params: { id: string } }>("/invoices/:id", async (req) => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, creatorId: creatorOf(req).id },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw notFound("Invoice not found");
    // Refresh in-flight payments so the detail view is live without waiting for the worker.
    const active = invoice.swaps.filter((s) => !isTerminal(s.status) && s.status !== "PENDING_DEPOSIT");
    if (active.length > 0) {
      await Promise.all(active.map(refreshSwap));
      const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: INVOICE_INCLUDE });
      return toInvoiceDTO(fresh);
    }
    return toInvoiceDTO(invoice);
  });

  app.put<{ Params: { id: string } }>("/invoices/:id", async (req) => {
    const body = parseBody(updateInvoiceSchema, req);
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, creatorId: creatorOf(req).id },
      include: { swaps: true },
    });
    if (!invoice) throw notFound("Invoice not found");
    if (invoice.linkId) throw new HttpError(409, "Payments made through a payment link can't be edited.");
    if (invoice.status === "PAID") throw new HttpError(409, "Paid invoices can't be edited.");
    if (invoice.status === "CANCELLED") throw new HttpError(409, "Cancelled invoices can't be edited.");
    if (invoice.status === "PROCESSING") throw new HttpError(409, "A payment is in flight. You can edit once it settles or is refunded.");

    const amount = invoiceTotal(body.lineItems, body.currency);
    const priceChanged = Number(amount) !== Number(invoice.amount) || body.currency !== invoice.currency;
    if (priceChanged) {
      // Someone holding a quote for the old total could still pay it, so the total is frozen until that quote lapses.
      const liveQuote = invoice.swaps.find((s) => s.status === "PENDING_DEPOSIT" && s.deadline > new Date());
      if (liveQuote) {
        const until = liveQuote.deadline.toISOString();
        throw new HttpError(409, "Your client has a live quote for the current total. You can change the amount after it expires.", { lockedUntil: until });
      }
      if (invoice.payerMarkedPaidAt) {
        throw new HttpError(409, "Your client reported paying the current total in ZEC. Check your wallet before changing the amount.");
      }
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        title: body.title,
        description: body.description || null,
        lineItems: body.lineItems,
        currency: body.currency,
        amount,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        ...(body.billTo !== undefined ? { billTo: body.billTo, billToKey: body.billToKey ?? null } : {}),
        editedAt: new Date(),
      },
      include: INVOICE_INCLUDE,
    });
    return toInvoiceDTO(updated);
  });

  app.post<{ Params: { id: string } }>("/invoices/:id/cancel", async (req) => {
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, creatorId: creatorOf(req).id } });
    if (!invoice) throw notFound("Invoice not found");
    if (invoice.status === "PAID") throw new HttpError(409, "Paid invoices can't be cancelled");
    if (invoice.status === "PROCESSING") throw new HttpError(409, "A payment is in flight. Wait for it to settle or refund.");
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      include: INVOICE_INCLUDE,
    });
    return toInvoiceDTO(updated);
  });

  /** For direct shielded ZEC payments, which the platform can't observe without a viewing key. */
  app.post<{ Params: { id: string } }>("/invoices/:id/mark-paid", async (req) => {
    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, creatorId: creatorOf(req).id } });
    if (!invoice) throw notFound("Invoice not found");
    if (invoice.status === "PAID") throw new HttpError(409, "Invoice is already paid");
    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", paidAt: new Date() },
      include: INVOICE_INCLUDE,
    });
    return toInvoiceDTO(updated);
  });
}
