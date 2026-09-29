import { authVerifySchema, boxKeySchema, updateProfileSchema, type MeDTO } from "@petrapay/shared";
import type { FastifyInstance } from "fastify";
import { prisma, type Creator } from "../db.ts";
import { parseBody } from "../lib/http.ts";
import {
  createChallenge,
  creatorOf,
  currentCreator,
  destroySession,
  requireCreator,
  setSessionCookie,
  verifyChallenge,
} from "../services/auth.ts";

async function toMeDTO(creator: Creator): Promise<MeDTO> {
  const [freshAddresses, totalAddresses] = await Promise.all([
    prisma.shieldedAddress.count({ where: { creatorId: creator.id, assignedAt: null } }),
    prisma.shieldedAddress.count({ where: { creatorId: creator.id } }),
  ]);
  return {
    id: creator.id,
    publicKey: creator.publicKey,
    boxPublicKey: creator.boxPublicKey,
    displayName: creator.displayName,
    createdAt: creator.createdAt.toISOString(),
    freshAddresses,
    totalAddresses,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/challenge", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async () => createChallenge());

  app.post("/auth/verify", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = parseBody(authVerifySchema, req);
    const { creator, token } = await verifyChallenge(body);
    setSessionCookie(reply, token);
    return toMeDTO(creator);
  });

  app.post("/auth/logout", async (req, reply) => {
    await destroySession(req, reply);
    return { ok: true };
  });

  app.get("/me", { preHandler: requireCreator }, async (req) => toMeDTO(creatorOf(req)));

  /** Like /me, but answers 200 with `me: null` for visitors so public pages don't log 401s. */
  app.get("/session", async (req) => {
    const creator = await currentCreator(req);
    return { me: creator ? await toMeDTO(creator) : null };
  });

  /** Registers the X25519 key payers seal form responses to. Derived from the recovery phrase in the browser. */
  app.put("/me/box", { preHandler: requireCreator }, async (req) => {
    const { boxPublicKey } = parseBody(boxKeySchema, req);
    const creator = await prisma.creator.update({ where: { id: creatorOf(req).id }, data: { boxPublicKey } });
    return toMeDTO(creator);
  });

  app.patch("/me", { preHandler: requireCreator }, async (req) => {
    const body = parseBody(updateProfileSchema, req);
    const creator = await prisma.creator.update({ where: { id: creatorOf(req).id }, data: { displayName: body.displayName } });
    return toMeDTO(creator);
  });
}
