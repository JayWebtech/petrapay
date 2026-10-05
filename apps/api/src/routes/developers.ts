import { createApiKeySchema, createWebhookSchema, updateWebhookSchema, type CreatedApiKeyDTO } from "@petrapay/shared";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.ts";
import { HttpError, notFound, parseBody } from "../lib/http.ts";
import { publicId } from "../lib/ids.ts";
import { generateApiKey, toApiKeyDTO } from "../services/api-keys.ts";
import { creatorOf, requireCreator } from "../services/auth.ts";
import {
  assertDeliverableUrl,
  attemptDelivery,
  emitEvent,
  newWebhookSecret,
  toDeliveryDTO,
  toEndpointDTOs,
  toEndpointDetailDTO,
} from "../services/webhooks.ts";

const MAX_ACTIVE_KEYS = 20;
const MAX_ENDPOINTS = 10;

/** "*" subsumes everything else; duplicates are dropped. */
const normalizeEvents = (events: string[]) => (events.includes("*") ? ["*"] : [...new Set(events)]);

/** Dashboard management of API keys and webhook endpoints (session auth). */
export async function developerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireCreator);

  // ---------- API keys ----------

  app.get("/api-keys", async (req) => {
    const keys = await prisma.apiKey.findMany({ where: { creatorId: creatorOf(req).id }, orderBy: { createdAt: "desc" } });
    return keys.map(toApiKeyDTO);
  });

  app.post("/api-keys", async (req, reply): Promise<CreatedApiKeyDTO> => {
    const creator = creatorOf(req);
    const { name } = parseBody(createApiKeySchema, req);
    const active = await prisma.apiKey.count({ where: { creatorId: creator.id, revokedAt: null } });
    if (active >= MAX_ACTIVE_KEYS) throw new HttpError(400, `You can have at most ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
    const { secret, hash, lastFour } = generateApiKey();
    const key = await prisma.apiKey.create({ data: { creatorId: creator.id, name, hash, lastFour } });
    reply.status(201);
    // The only time the full key leaves the server; only its hash is stored.
    return { key: toApiKeyDTO(key), secret };
  });

  app.delete<{ Params: { id: string } }>("/api-keys/:id", async (req) => {
    const key = await prisma.apiKey.findFirst({ where: { id: req.params.id, creatorId: creatorOf(req).id } });
    if (!key) throw notFound("API key not found");
    const revoked = key.revokedAt ? key : await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
    return toApiKeyDTO(revoked);
  });

  // ---------- Webhook endpoints ----------

  const loadEndpoint = async (creatorId: string, id: string) => {
    const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id, creatorId } });
    if (!endpoint) throw notFound("Webhook endpoint not found");
    return endpoint;
  };

  app.get("/webhooks", async (req) => {
    const endpoints = await prisma.webhookEndpoint.findMany({ where: { creatorId: creatorOf(req).id }, orderBy: { createdAt: "desc" } });
    return toEndpointDTOs(endpoints);
  });

  app.post("/webhooks", async (req, reply) => {
    const creator = creatorOf(req);
    const body = parseBody(createWebhookSchema, req);
    if ((await prisma.webhookEndpoint.count({ where: { creatorId: creator.id } })) >= MAX_ENDPOINTS) {
      throw new HttpError(400, `You can have at most ${MAX_ENDPOINTS} webhook endpoints.`);
    }
    await assertDeliverableUrl(body.url);
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        id: `we_${publicId(16)}`,
        creatorId: creator.id,
        url: body.url,
        description: body.description || null,
        events: normalizeEvents(body.events),
        secret: newWebhookSecret(),
      },
    });
    reply.status(201);
    return toEndpointDetailDTO(endpoint);
  });

  app.get<{ Params: { id: string } }>("/webhooks/:id", async (req) => toEndpointDetailDTO(await loadEndpoint(creatorOf(req).id, req.params.id)));

  app.patch<{ Params: { id: string } }>("/webhooks/:id", async (req) => {
    const endpoint = await loadEndpoint(creatorOf(req).id, req.params.id);
    const body = parseBody(updateWebhookSchema, req);
    if (body.url && body.url !== endpoint.url) await assertDeliverableUrl(body.url);
    const updated = await prisma.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: {
        ...(body.url ? { url: body.url } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.events ? { events: normalizeEvents(body.events) } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
    });
    return toEndpointDetailDTO(updated);
  });

  app.delete<{ Params: { id: string } }>("/webhooks/:id", async (req) => {
    const endpoint = await loadEndpoint(creatorOf(req).id, req.params.id);
    await prisma.webhookEndpoint.delete({ where: { id: endpoint.id } });
    return { deleted: true };
  });

  app.post<{ Params: { id: string } }>("/webhooks/:id/rotate-secret", async (req) => {
    const endpoint = await loadEndpoint(creatorOf(req).id, req.params.id);
    const updated = await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { secret: newWebhookSecret() } });
    return toEndpointDetailDTO(updated);
  });

  /** Sends a `ping` event to this endpoint right away and reports what happened. */
  app.post<{ Params: { id: string } }>("/webhooks/:id/test", async (req) => {
    const creator = creatorOf(req);
    const endpoint = await loadEndpoint(creator.id, req.params.id);
    if (!endpoint.active) throw new HttpError(409, "Enable the endpoint before sending a test event.");
    const event = await emitEvent(creator.id, "ping", { object: "ping", message: "Test event from PetraPay." }, endpoint.id);
    const delivery = event?.deliveries[0];
    if (!event || !delivery) throw new HttpError(500, "Couldn't create the test event");
    const attempted = await attemptDelivery({ ...delivery, event, endpoint });
    return toDeliveryDTO({ ...attempted, event });
  });

  app.get<{ Params: { id: string } }>("/webhooks/:id/deliveries", async (req) => {
    const endpoint = await loadEndpoint(creatorOf(req).id, req.params.id);
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: endpoint.id },
      include: { event: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return deliveries.map(toDeliveryDTO);
  });

  app.post<{ Params: { id: string; deliveryId: string } }>("/webhooks/:id/deliveries/:deliveryId/retry", async (req) => {
    const endpoint = await loadEndpoint(creatorOf(req).id, req.params.id);
    const delivery = await prisma.webhookDelivery.findFirst({ where: { id: req.params.deliveryId, endpointId: endpoint.id }, include: { event: true } });
    if (!delivery) throw notFound("Delivery not found");
    if (!endpoint.active) throw new HttpError(409, "Enable the endpoint before retrying.");
    const attempted = await attemptDelivery({ ...delivery, endpoint });
    return toDeliveryDTO({ ...attempted, event: delivery.event });
  });
}
