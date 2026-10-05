import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { WebhookDeliveryDTO, WebhookEndpointDTO, WebhookEndpointDetailDTO, WebhookEventType } from "@petrapay/shared";
import { Prisma, prisma, type WebhookDelivery, type WebhookEndpoint, type WebhookEvent } from "../db.ts";
import { env } from "../env.ts";
import { HttpError } from "../lib/http.ts";
import { publicId, randomToken } from "../lib/ids.ts";
import { toCheckoutObject } from "./objects.ts";

/**
 * Webhooks: events are written to an outbox (one delivery row per subscribed endpoint) and a worker
 * POSTs them, signed like Stripe's: `PetraPay-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`.
 * Failed deliveries retry with backoff for about two days.
 */

/** Delay before attempt n+1, after n failed attempts. */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 5 * 3_600_000, 10 * 3_600_000, 24 * 3_600_000];
const MAX_ATTEMPTS = BACKOFF_MS.length + 1;
const TIMEOUT_MS = 10_000;
/** A claimed delivery is hidden from other workers this long, in case this one dies mid-request. */
const LEASE_MS = 2 * 60_000;
const BODY_LIMIT = 1_000;

export const newWebhookSecret = () => `whsec_${randomToken(24)}`;

export function signatureHeader(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

// ---------- URL safety ----------

// Private, loopback, link-local, CGNAT, multicast and reserved ranges: a merchant-supplied URL must
// never make this server call into its own network (cloud metadata, the database, other services).
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return blocked.check(mapped[1]!, "ipv4");
  return blocked.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

/** Throws unless `url` is https and resolves only to public addresses (relaxed by WEBHOOK_ALLOW_PRIVATE). */
export async function assertDeliverableUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError(400, "Enter a full webhook URL");
  }
  if (parsed.protocol !== "https:" && !(env.WEBHOOK_ALLOW_PRIVATE && parsed.protocol === "http:")) {
    throw new HttpError(400, "Webhook URLs must use https");
  }
  if (parsed.username || parsed.password) throw new HttpError(400, "Webhook URLs can't contain credentials");
  if (env.WEBHOOK_ALLOW_PRIVATE) return;
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new HttpError(400, `Couldn't resolve ${host}`);
  }
  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new HttpError(400, "Webhook URLs must point to a public address");
  }
}

// ---------- Emitting ----------

/** Records an event and queues it for every active endpoint subscribed to `type`. Never throws. */
export async function emitEvent(creatorId: string, type: WebhookEventType | "ping", object: unknown, onlyEndpointId?: string) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { creatorId, active: true, ...(onlyEndpointId ? { id: onlyEndpointId } : {}) },
      select: { id: true, events: true },
    });
    const targets = onlyEndpointId ? endpoints : endpoints.filter((e) => e.events.includes("*") || e.events.includes(type));
    if (targets.length === 0) return null;
    const id = `evt_${publicId(24)}`;
    const payload = { id, object: "event", type, created: Math.floor(Date.now() / 1000), data: { object } };
    return await prisma.webhookEvent.create({
      data: {
        id,
        creatorId,
        type,
        payload: payload as Prisma.InputJsonValue,
        deliveries: { create: targets.map((t) => ({ endpointId: t.id })) },
      },
      include: { deliveries: true },
    });
  } catch (err) {
    console.error("failed to record webhook event", type, err);
    return null;
  }
}

/** Emits a checkout.* event with the checkout as it is now. */
export async function emitCheckoutEvent(invoiceId: string, type: WebhookEventType) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } }).catch(() => null);
  if (invoice) await emitEvent(invoice.creatorId, type, toCheckoutObject(invoice));
}

// ---------- Delivering ----------

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < BODY_LIMIT) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).toString("utf8").slice(0, BODY_LIMIT);
}

type DeliveryWithRelations = WebhookDelivery & { event: WebhookEvent; endpoint: WebhookEndpoint };

/** One POST attempt; records the outcome and schedules a retry if needed. */
export async function attemptDelivery(delivery: DeliveryWithRelations): Promise<WebhookDelivery> {
  const { endpoint, event } = delivery;
  const body = JSON.stringify(event.payload);
  let status: number | null = null;
  let responseBody: string;
  try {
    await assertDeliverableUrl(endpoint.url);
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PetraPay-Webhooks/1.0",
        "PetraPay-Signature": signatureHeader(endpoint.secret, body),
        "PetraPay-Event-Id": event.id,
        "PetraPay-Event-Type": event.type,
      },
      body,
      // A redirect could point anywhere, including into the private network.
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
    responseBody = await readCapped(res);
  } catch (err) {
    responseBody =
      err instanceof HttpError ? err.message : err instanceof Error && err.name === "TimeoutError" ? "Timed out after 10s" : (err as Error).message || "Request failed";
  }

  const ok = status !== null && status >= 200 && status < 300;
  const attempts = delivery.attempts + 1;
  const giveUp = !ok && attempts >= MAX_ATTEMPTS;
  return prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      attempts,
      lastAttemptAt: new Date(),
      responseStatus: status,
      responseBody,
      status: ok ? "SUCCEEDED" : giveUp ? "FAILED" : "PENDING",
      nextAttemptAt: ok || giveUp ? new Date() : new Date(Date.now() + BACKOFF_MS[attempts - 1]!),
    },
  });
}

/** Sends due deliveries. Safe across several API instances: rows are claimed with SKIP LOCKED. */
export async function deliverDueWebhooks(limit = 20): Promise<number> {
  const ids = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "WebhookDelivery"
      WHERE status = 'PENDING' AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    if (rows.length > 0) {
      await tx.webhookDelivery.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { nextAttemptAt: new Date(Date.now() + LEASE_MS) } });
    }
    return rows.map((r) => r.id);
  });
  if (ids.length === 0) return 0;
  const deliveries = await prisma.webhookDelivery.findMany({ where: { id: { in: ids } }, include: { event: true, endpoint: true } });
  await Promise.all(
    deliveries.map((d) =>
      d.endpoint.active
        ? attemptDelivery(d)
        : prisma.webhookDelivery.update({ where: { id: d.id }, data: { status: "FAILED", responseBody: "Endpoint disabled" } }),
    ),
  );
  return deliveries.length;
}

// ---------- DTOs ----------

export async function toEndpointDTOs(endpoints: WebhookEndpoint[]): Promise<WebhookEndpointDTO[]> {
  const since = new Date(Date.now() - 7 * 86_400_000);
  const counts = await prisma.webhookDelivery.groupBy({
    by: ["endpointId", "status"],
    where: { endpointId: { in: endpoints.map((e) => e.id) }, createdAt: { gte: since } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  return endpoints.map((e) => {
    const mine = counts.filter((c) => c.endpointId === e.id);
    const count = (s: string) => mine.find((c) => c.status === s)?._count._all ?? 0;
    const last = mine.map((c) => c._max.createdAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
    return {
      id: e.id,
      url: e.url,
      description: e.description,
      events: e.events,
      active: e.active,
      createdAt: e.createdAt.toISOString(),
      recent: {
        total: mine.reduce((n, c) => n + c._count._all, 0),
        failed: count("FAILED"),
        pending: count("PENDING"),
        lastAt: last?.toISOString() ?? null,
      },
    };
  });
}

export async function toEndpointDetailDTO(endpoint: WebhookEndpoint): Promise<WebhookEndpointDetailDTO> {
  const [dto] = await toEndpointDTOs([endpoint]);
  return { ...dto!, secret: endpoint.secret };
}

export function toDeliveryDTO(d: WebhookDelivery & { event: WebhookEvent }): WebhookDeliveryDTO {
  return {
    id: d.id,
    eventId: d.eventId,
    eventType: d.event.type,
    status: d.status,
    attempts: d.attempts,
    responseStatus: d.responseStatus,
    responseBody: d.responseBody,
    createdAt: d.createdAt.toISOString(),
    lastAttemptAt: d.lastAttemptAt?.toISOString() ?? null,
    nextAttemptAt: d.status === "PENDING" ? d.nextAttemptAt.toISOString() : null,
    payload: d.event.payload,
  };
}

export { MAX_ATTEMPTS };
