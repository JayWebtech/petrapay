import {
  ZEC_ASSET_ID,
  createLinkSchema,
  formatZats,
  linkCheckoutSchema,
  linkQuoteSchema,
  updateLinkSchema,
  type LinkCheckoutDTO,
  type LinkField,
  type PaymentLinkDTO,
  type PaymentLinkDetailDTO,
  type PublicLinkDTO,
} from "@petrapay/shared";
import type { FastifyInstance } from "fastify";
import { prisma, type PaymentLink } from "../db.ts";
import { HttpError, badRequest, notFound, parseBody } from "../lib/http.ts";
import { publicId } from "../lib/ids.ts";
import { creatorOf, requireCreator } from "../services/auth.ts";
import { INVOICE_INCLUDE, createInvoice, discardInvoice, toInvoiceDTO, toPublicInvoiceDTO } from "../services/invoices.ts";
import { getToken } from "../services/oneclick.ts";
import { previewPayment, quoteInvoicePayment } from "../services/payments.ts";

const MIN = { USD: 1, ZEC: 0.001 } as const;
const DECIMALS = { USD: 2, ZEC: 8 } as const;

function checkPrecision(value: string, currency: "USD" | "ZEC", label: string) {
  const frac = value.split(".")[1] ?? "";
  if (frac.length > DECIMALS[currency]) throw badRequest(`${label} can have at most ${DECIMALS[currency]} decimals`);
  if (Number(value) < MIN[currency]) throw badRequest(`${label} must be at least ${currency === "USD" ? "$1.00" : "0.001 ZEC"}`);
}

/** The amount a payer may pay through this link, or a 400 explaining why not. */
function validateAmount(link: PaymentLink, amount: string) {
  checkPrecision(amount, link.currency, "Amount");
  const n = Number(amount);
  if (link.amountType === "FIXED" && n !== Number(link.amount)) throw badRequest("This link has a fixed price");
  if (link.minAmount && n < Number(link.minAmount)) throw badRequest(`The minimum is ${link.minAmount.toString()} ${link.currency}`);
  if (link.maxAmount && n > Number(link.maxAmount)) throw badRequest(`The maximum is ${link.maxAmount.toString()} ${link.currency}`);
}

type LinkStats = PaymentLinkDTO["stats"];

function toLinkDTO(link: PaymentLink, stats: LinkStats): PaymentLinkDTO {
  return {
    id: link.id,
    title: link.title,
    description: link.description,
    currency: link.currency,
    amountType: link.amountType,
    amount: link.amount?.toString() ?? null,
    minAmount: link.minAmount?.toString() ?? null,
    maxAmount: link.maxAmount?.toString() ?? null,
    presets: link.presets as string[],
    fields: link.fields as LinkField[],
    active: link.active,
    createdAt: link.createdAt.toISOString(),
    stats,
  };
}

async function statsFor(linkIds: string[]): Promise<Map<string, LinkStats>> {
  const rows = await prisma.invoice.findMany({
    where: { linkId: { in: linkIds } },
    select: { linkId: true, status: true, receivedZats: true, receivedUsd: true },
  });
  const out = new Map<string, { started: number; paid: number; zats: bigint; usd: number }>();
  for (const id of linkIds) out.set(id, { started: 0, paid: 0, zats: 0n, usd: 0 });
  for (const r of rows) {
    const s = out.get(r.linkId!)!;
    s.started += 1;
    if (r.status === "PAID") {
      s.paid += 1;
      s.zats += r.receivedZats ?? 0n;
      s.usd += Number(r.receivedUsd ?? 0);
    }
  }
  return new Map(
    [...out].map(([id, s]) => [id, { started: s.started, paid: s.paid, receivedZec: formatZats(s.zats), receivedUsd: s.usd.toFixed(2) }]),
  );
}

/** Creator-side management of payment links. */
export async function linkRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireCreator);

  app.get("/links", async (req) => {
    const links = await prisma.paymentLink.findMany({ where: { creatorId: creatorOf(req).id }, orderBy: { createdAt: "desc" }, take: 200 });
    const stats = await statsFor(links.map((l) => l.id));
    return links.map((l) => toLinkDTO(l, stats.get(l.id)!));
  });

  app.post("/links", async (req, reply) => {
    const creator = creatorOf(req);
    const body = parseBody(createLinkSchema, req);
    if (body.amountType === "FIXED") checkPrecision(body.amount!, body.currency, "Price");
    if (body.minAmount) checkPrecision(body.minAmount, body.currency, "Minimum");
    if (body.maxAmount) checkPrecision(body.maxAmount, body.currency, "Maximum");
    for (const p of body.presets) checkPrecision(p, body.currency, "Suggested amount");
    if (body.fields.length > 0 && !creator.boxPublicKey) {
      throw badRequest("Set up encrypted responses before collecting fields. Sign in again with your recovery phrase on this device.");
    }
    if ((await prisma.shieldedAddress.count({ where: { creatorId: creator.id } })) === 0) {
      throw badRequest("Add a shielded Zcash address before creating payment links.");
    }

    const fixed = body.amountType === "FIXED";
    const link = await prisma.paymentLink.create({
      data: {
        id: publicId(),
        creatorId: creator.id,
        title: body.title,
        description: body.description || null,
        currency: body.currency,
        amountType: body.amountType,
        amount: fixed ? body.amount : null,
        minAmount: fixed ? null : (body.minAmount ?? null),
        maxAmount: fixed ? null : (body.maxAmount ?? null),
        presets: fixed ? [] : body.presets,
        fields: body.fields,
      },
    });
    reply.status(201);
    return toLinkDTO(link, { started: 0, paid: 0, receivedZec: "0", receivedUsd: "0.00" });
  });

  app.get<{ Params: { id: string } }>("/links/:id", async (req): Promise<PaymentLinkDetailDTO> => {
    const link = await prisma.paymentLink.findFirst({
      where: { id: req.params.id, creatorId: creatorOf(req).id },
      include: { invoices: { include: INVOICE_INCLUDE, orderBy: { createdAt: "desc" }, take: 200 } },
    });
    if (!link) throw notFound("Payment link not found");
    const stats = await statsFor([link.id]);
    return { ...toLinkDTO(link, stats.get(link.id)!), payments: await Promise.all(link.invoices.map(toInvoiceDTO)) };
  });

  app.patch<{ Params: { id: string } }>("/links/:id", async (req) => {
    const { active } = parseBody(updateLinkSchema, req);
    const found = await prisma.paymentLink.findFirst({ where: { id: req.params.id, creatorId: creatorOf(req).id } });
    if (!found) throw notFound("Payment link not found");
    const link = await prisma.paymentLink.update({ where: { id: found.id }, data: { active } });
    const stats = await statsFor([link.id]);
    return toLinkDTO(link, stats.get(link.id)!);
  });
}

async function loadPublicLink(id: string) {
  const link = await prisma.paymentLink.findUnique({ where: { id }, include: { creator: true } });
  if (!link) throw notFound("Payment link not found");
  return link;
}

/** Payer-side: view a link, preview a quote, and commit to paying (which creates the invoice). */
export async function publicLinkRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>("/public/links/:id", async (req): Promise<PublicLinkDTO> => {
    const link = await loadPublicLink(req.params.id);
    const zec = await getToken(ZEC_ASSET_ID).catch(() => undefined);
    return {
      id: link.id,
      title: link.title,
      description: link.description,
      currency: link.currency,
      amountType: link.amountType,
      amount: link.amount?.toString() ?? null,
      minAmount: link.minAmount?.toString() ?? null,
      maxAmount: link.maxAmount?.toString() ?? null,
      presets: link.presets as string[],
      fields: link.fields as LinkField[],
      active: link.active,
      creatorName: link.creator.displayName ?? "A PetraPay creator",
      boxPublicKey: link.creator.boxPublicKey,
      zecPriceUsd: zec?.priceUsd ?? null,
    };
  });

  app.post<{ Params: { id: string } }>("/public/links/:id/quote", { config: { rateLimit: { max: 40, timeWindow: "1 minute" } } }, async (req) => {
    const body = parseBody(linkQuoteSchema, req);
    const link = await loadPublicLink(req.params.id);
    if (!link.active) throw new HttpError(409, "This link is no longer accepting payments.");
    validateAmount(link, body.amount);
    // A preview never executes, so any of the creator's addresses stands in for the fresh one checkout will assign.
    const address =
      (await prisma.shieldedAddress.findFirst({ where: { creatorId: link.creatorId, isDefault: true } })) ??
      (await prisma.shieldedAddress.findFirst({ where: { creatorId: link.creatorId } }));
    if (!address) throw new HttpError(409, "This creator hasn't finished setting up payments yet.");
    return previewPayment({ originAsset: body.originAsset, currency: link.currency, amount: body.amount, recipient: address.address });
  });

  app.post<{ Params: { id: string } }>(
    "/public/links/:id/checkout",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply): Promise<LinkCheckoutDTO> => {
      const body = parseBody(linkCheckoutSchema, req);
      const link = await loadPublicLink(req.params.id);
      if (!link.active) throw new HttpError(409, "This link is no longer accepting payments.");
      validateAmount(link, body.amount);

      const fields = link.fields as LinkField[];
      if (fields.some((f) => f.required) && !body.responses) throw badRequest("Fill in the required fields");
      if (body.responses && !body.responses.startsWith("box1:")) throw badRequest("Responses must be encrypted in the browser");
      if (body.method === "token") {
        if (!body.originAsset || !body.refundTo) throw badRequest("Choose a token and enter your refund address");
        if (!(await getToken(body.originAsset))) throw badRequest("Unsupported token");
      }

      const invoice = await createInvoice(link.creatorId, {
        title: link.title,
        description: link.description,
        lineItems: [{ description: link.title, quantity: 1, unitAmount: body.amount }],
        currency: link.currency,
        amount: body.amount,
        linkId: link.id,
        responses: body.responses ?? null,
      });
      const withCreator = { ...invoice, creator: link.creator };

      if (body.method === "zec") {
        reply.status(201);
        return { invoice: await toPublicInvoiceDTO(withCreator), swap: null };
      }

      try {
        const swap = await quoteInvoicePayment(invoice, { originAsset: body.originAsset!, refundTo: body.refundTo, dry: false });
        reply.status(201);
        return { invoice: await toPublicInvoiceDTO(withCreator), swap: swap as LinkCheckoutDTO["swap"] };
      } catch (err) {
        // No payment started, so don't leave an empty invoice holding one of the creator's fresh addresses.
        await discardInvoice(invoice);
        throw err;
      }
    },
  );
}
