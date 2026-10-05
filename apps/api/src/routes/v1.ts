import { createHash } from "node:crypto";
import {
  v1CreateCheckoutSchema,
  v1CreatePaymentLinkSchema,
  v1UpdatePaymentLinkSchema,
  type CreateLinkInput,
  type InvoiceStatus,
  type LineItem,
} from "@petrapay/shared";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { Prisma, prisma } from "../db.ts";
import { HttpError } from "../lib/http.ts";
import { hashSecret, requireApiKey } from "../services/api-keys.ts";
import { creatorOf } from "../services/auth.ts";
import { cancelInvoice, createInvoice, invoiceTotal } from "../services/invoices.ts";
import { createPaymentLink } from "../services/links.ts";
import { toCheckoutObject, toPaymentLinkObject } from "../services/objects.ts";
import { emitCheckoutEvent } from "../services/webhooks.ts";

/**
 * Public merchant API, authenticated with secret keys (`Authorization: Bearer pp_sk_…`).
 * Stripe-style: snake_case objects, `{ object: "list", data, has_more }` lists with `starting_after`
 * cursors, `{ error: { type, message, param } }` errors, and `Idempotency-Key` on POSTs.
 */

const DEFAULT_EXPIRY_S = 24 * 3600;
const IDEMPOTENCY_TTL_MS = 24 * 3_600_000;

type ErrorType = "invalid_request_error" | "authentication_error" | "rate_limit_error" | "idempotency_error" | "api_error";

const fail = (status: number, message: string, type: ErrorType = "invalid_request_error", param?: string) =>
  new HttpError(status, message, { type, ...(param ? { param } : {}) });

function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const param = issue?.path.join(".") || undefined;
  throw fail(400, issue ? `${param ? `${param}: ` : ""}${issue.message}` : "Invalid request", "invalid_request_error", param);
}

function listParams(query: unknown) {
  const q = (query ?? {}) as Record<string, string | undefined>;
  const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "10", 10) || 10));
  return { limit, startingAfter: q.starting_after, q };
}

/**
 * Runs `create` at most once per Idempotency-Key (per merchant, for 24 hours). A repeat with the same
 * request replays the first response; a repeat with different parameters is an error.
 */
async function idempotent(req: FastifyRequest, reply: FastifyReply, create: () => Promise<{ status: number; body: unknown }>) {
  const header = req.headers["idempotency-key"];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) {
    const result = await create();
    reply.status(result.status);
    return result.body;
  }
  if (key.length > 255) throw fail(400, "Idempotency-Key must be at most 255 characters", "invalid_request_error");

  const creatorId = creatorOf(req).id;
  const requestHash = createHash("sha256").update(`${req.method} ${req.url} ${JSON.stringify(req.body ?? null)}`).digest("hex");
  const where = { creatorId_key: { creatorId, key } };

  let existing = await prisma.idempotencyKey.findUnique({ where });
  if (existing && Date.now() - existing.createdAt.getTime() > IDEMPOTENCY_TTL_MS) {
    await prisma.idempotencyKey.delete({ where }).catch(() => undefined);
    existing = null;
  }
  if (existing) {
    if (existing.requestHash !== requestHash) throw fail(400, "This Idempotency-Key was already used with different parameters.", "idempotency_error");
    if (existing.statusCode === 0) throw fail(409, "A request with this Idempotency-Key is still in progress.", "idempotency_error");
    reply.header("Idempotent-Replayed", "true");
    reply.status(existing.statusCode);
    return existing.body;
  }

  // Claim the key first so two concurrent retries can't both create.
  try {
    await prisma.idempotencyKey.create({ data: { creatorId, key, requestHash, statusCode: 0, body: {} } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw fail(409, "A request with this Idempotency-Key is still in progress.", "idempotency_error");
    }
    throw err;
  }
  try {
    const result = await create();
    await prisma.idempotencyKey.update({ where, data: { statusCode: result.status, body: result.body as Prisma.InputJsonValue } });
    reply.status(result.status);
    return result.body;
  } catch (err) {
    // Failed requests don't consume the key, so the merchant can fix the request and retry.
    await prisma.idempotencyKey.delete({ where }).catch(() => undefined);
    throw err;
  }
}

const STATUS_FILTER: Record<string, InvoiceStatus> = {
  open: "OPEN",
  processing: "PROCESSING",
  paid: "PAID",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
};

export async function v1Routes(app: FastifyInstance) {
  // Rate limits are per key, so one merchant's traffic doesn't throttle another behind the same proxy.
  const config = {
    rateLimit: {
      max: 120,
      timeWindow: "1 minute",
      keyGenerator: (req: FastifyRequest) => (req.headers.authorization ? hashSecret(req.headers.authorization) : req.ip),
    },
  };

  app.addHook("preHandler", requireApiKey);

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    const status = err instanceof HttpError ? err.status : (err.statusCode ?? 500);
    const details = (err instanceof HttpError ? err.details : undefined) as { type?: ErrorType; param?: string } | undefined;
    const type: ErrorType =
      details?.type ?? (status === 401 ? "authentication_error" : status === 429 ? "rate_limit_error" : status >= 500 ? "api_error" : "invalid_request_error");
    if (status >= 500) req.log.error({ err }, "v1 api error");
    const message = status >= 500 && !(err instanceof HttpError) ? "Something went wrong on our side. Try again." : err.message;
    return reply.status(status).send({ error: { type, message, ...(details?.param ? { param: details.param } : {}) } });
  });

  app.setNotFoundHandler((req, reply) =>
    reply.status(404).send({ error: { type: "invalid_request_error", message: `Unrecognized request URL (${req.method} ${req.url}).` } }),
  );

  // ---------- Checkouts ----------

  app.post("/checkouts", { config }, async (req, reply) =>
    idempotent(req, reply, async () => {
      const creator = creatorOf(req);
      const body = parse(v1CreateCheckoutSchema, req.body);
      const lineItems: LineItem[] = body.line_items
        ? body.line_items.map((l) => ({ description: l.description, quantity: l.quantity, unitAmount: l.unit_amount }))
        : [{ description: body.title, quantity: 1, unitAmount: body.amount! }];
      const amount = invoiceTotal(lineItems, body.currency);
      const invoice = await createInvoice(creator.id, {
        title: body.title,
        description: body.description,
        lineItems,
        currency: body.currency,
        amount,
        clientName: body.customer?.name || null,
        clientEmail: body.customer?.email || null,
        source: "API",
        reference: body.reference ?? null,
        metadata: body.metadata ?? null,
        successUrl: body.success_url ?? null,
        cancelUrl: body.cancel_url ?? null,
        expiresAt: new Date(Date.now() + (body.expires_in ?? DEFAULT_EXPIRY_S) * 1000),
      });
      void emitCheckoutEvent(invoice.id, "checkout.created");
      return { status: 201, body: toCheckoutObject(invoice) };
    }),
  );

  app.get("/checkouts", { config }, async (req) => {
    const creatorId = creatorOf(req).id;
    const { limit, startingAfter, q } = listParams(req.query);
    const status = q.status ? STATUS_FILTER[q.status] : undefined;
    if (q.status && !status) throw fail(400, `status must be one of ${Object.keys(STATUS_FILTER).join(", ")}`, "invalid_request_error", "status");
    if (startingAfter && !(await prisma.invoice.findFirst({ where: { id: startingAfter, creatorId }, select: { id: true } }))) {
      throw fail(400, `No such checkout: ${startingAfter}`, "invalid_request_error", "starting_after");
    }
    const rows = await prisma.invoice.findMany({
      where: { creatorId, ...(status ? { status } : {}), ...(q.reference ? { reference: q.reference } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(startingAfter ? { cursor: { id: startingAfter }, skip: 1 } : {}),
    });
    return { object: "list", data: rows.slice(0, limit).map(toCheckoutObject), has_more: rows.length > limit };
  });

  const loadCheckout = async (creatorId: string, id: string) => {
    const invoice = await prisma.invoice.findFirst({ where: { id, creatorId } });
    if (!invoice) throw fail(404, `No such checkout: ${id}`, "invalid_request_error", "id");
    return invoice;
  };

  app.get<{ Params: { id: string } }>("/checkouts/:id", { config }, async (req) => toCheckoutObject(await loadCheckout(creatorOf(req).id, req.params.id)));

  app.post<{ Params: { id: string } }>("/checkouts/:id/cancel", { config }, async (req) => {
    const invoice = await loadCheckout(creatorOf(req).id, req.params.id);
    return toCheckoutObject(await cancelInvoice(invoice));
  });

  // ---------- Payment links ----------

  app.post("/payment_links", { config }, async (req, reply) =>
    idempotent(req, reply, async () => {
      const body = parse(v1CreatePaymentLinkSchema, req.body);
      const fixed = body.amount_type === "fixed";
      if (fixed && !body.amount) throw fail(400, "amount is required for fixed-price links", "invalid_request_error", "amount");
      if (body.min_amount && body.max_amount && Number(body.max_amount) < Number(body.min_amount)) {
        throw fail(400, "max_amount must be at least min_amount", "invalid_request_error", "max_amount");
      }
      const input: CreateLinkInput = {
        title: body.title,
        description: body.description,
        currency: body.currency,
        amountType: fixed ? "FIXED" : "CUSTOM",
        amount: body.amount,
        minAmount: body.min_amount,
        maxAmount: body.max_amount,
        presets: body.presets ?? [],
        // Custom form fields are encrypted to a key that only exists in the merchant's browser,
        // so they're configured from the dashboard.
        fields: [],
      };
      const link = await createPaymentLink(creatorOf(req), input);
      return { status: 201, body: toPaymentLinkObject(link) };
    }),
  );

  app.get("/payment_links", { config }, async (req) => {
    const creatorId = creatorOf(req).id;
    const { limit, startingAfter } = listParams(req.query);
    if (startingAfter && !(await prisma.paymentLink.findFirst({ where: { id: startingAfter, creatorId }, select: { id: true } }))) {
      throw fail(400, `No such payment link: ${startingAfter}`, "invalid_request_error", "starting_after");
    }
    const rows = await prisma.paymentLink.findMany({
      where: { creatorId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(startingAfter ? { cursor: { id: startingAfter }, skip: 1 } : {}),
    });
    return { object: "list", data: rows.slice(0, limit).map(toPaymentLinkObject), has_more: rows.length > limit };
  });

  const loadLink = async (creatorId: string, id: string) => {
    const link = await prisma.paymentLink.findFirst({ where: { id, creatorId } });
    if (!link) throw fail(404, `No such payment link: ${id}`, "invalid_request_error", "id");
    return link;
  };

  app.get<{ Params: { id: string } }>("/payment_links/:id", { config }, async (req) => toPaymentLinkObject(await loadLink(creatorOf(req).id, req.params.id)));

  app.post<{ Params: { id: string } }>("/payment_links/:id", { config }, async (req) => {
    const link = await loadLink(creatorOf(req).id, req.params.id);
    const { active } = parse(v1UpdatePaymentLinkSchema, req.body);
    return toPaymentLinkObject(await prisma.paymentLink.update({ where: { id: link.id }, data: { active } }));
  });
}
