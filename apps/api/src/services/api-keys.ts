import { createHash } from "node:crypto";
import type { ApiKeyDTO } from "@petrapay/shared";
import type { FastifyRequest } from "fastify";
import { prisma, type ApiKey } from "../db.ts";
import { HttpError } from "../lib/http.ts";
import { randomToken } from "../lib/ids.ts";

/** Secret keys look like `pp_sk_` + 43 url-safe characters (256 bits). */
export const API_KEY_PREFIX = "pp_sk_";

declare module "fastify" {
  interface FastifyRequest {
    apiKeyId?: string;
  }
}

export const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

export function generateApiKey() {
  const secret = API_KEY_PREFIX + randomToken(32);
  return { secret, hash: hashSecret(secret), lastFour: secret.slice(-4) };
}

export function toApiKeyDTO(key: ApiKey): ApiKeyDTO {
  return {
    id: key.id,
    name: key.name,
    preview: `${API_KEY_PREFIX}…${key.lastFour}`,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
  };
}

/** preHandler for the public API: `Authorization: Bearer pp_sk_…` → the key's creator. */
export async function requireApiKey(req: FastifyRequest) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  const secret = match?.[1];
  if (!secret || !secret.startsWith(API_KEY_PREFIX)) {
    throw new HttpError(401, "Missing API key. Send it as `Authorization: Bearer pp_sk_…`.", { type: "authentication_error" });
  }
  const key = await prisma.apiKey.findUnique({ where: { hash: hashSecret(secret) }, include: { creator: true } });
  if (!key || key.revokedAt) throw new HttpError(401, "Invalid or revoked API key.", { type: "authentication_error" });
  req.creator = key.creator;
  req.apiKeyId = key.id;
  // "Last used" only needs minute precision; skip the write on busy keys.
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    void prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
}
