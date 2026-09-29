import { createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma, type Creator } from "../db.ts";
import { env } from "../env.ts";
import { HttpError } from "../lib/http.ts";
import { randomToken } from "../lib/ids.ts";

export const SESSION_COOKIE = "pp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const CHALLENGE_TTL_MS = 5 * 60_000;

/** The exact bytes the browser signs. Keep in sync with apps/web/src/lib/identity.ts. */
export function challengeMessage(nonce: string): string {
  return `PetraPay sign-in\n\nSign this message to prove you own this account key.\nNonce: ${nonce}`;
}

export async function createChallenge() {
  const nonce = randomToken(24);
  await prisma.authChallenge.create({ data: { nonce, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) } });
  // Opportunistic cleanup; challenges are tiny and short-lived.
  await prisma.authChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { nonce, message: challengeMessage(nonce) };
}

export async function verifyChallenge(input: { publicKey: string; signature: string; nonce: string }) {
  // Single use: delete first so a replayed signature can't win a race.
  const challenge = await prisma.authChallenge.delete({ where: { nonce: input.nonce } }).catch(() => null);
  if (!challenge || challenge.expiresAt < new Date()) throw new HttpError(401, "Sign-in challenge expired. Try again.");

  const message = new TextEncoder().encode(challengeMessage(input.nonce));
  let valid = false;
  try {
    valid = ed25519.verify(hexToBytes(input.signature), message, hexToBytes(input.publicKey));
  } catch {
    valid = false;
  }
  if (!valid) throw new HttpError(401, "Signature verification failed");

  const creator = await prisma.creator.upsert({
    where: { publicKey: input.publicKey },
    create: { publicKey: input.publicKey },
    update: {},
  });

  const token = randomToken(32);
  await prisma.session.create({
    data: { creatorId: creator.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return { creator, token };
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

declare module "fastify" {
  interface FastifyRequest {
    creator?: Creator;
  }
}

export async function currentCreator(req: FastifyRequest): Promise<Creator | null> {
  const token = req.cookies[SESSION_COOKIE];
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { creator: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.creator;
}

/** preHandler that loads the creator from the session cookie, or rejects with 401. */
export async function requireCreator(req: FastifyRequest) {
  const creator = await currentCreator(req);
  if (!creator) throw new HttpError(401, "Not signed in");
  req.creator = creator;
}

export function creatorOf(req: FastifyRequest): Creator {
  if (!req.creator) throw new HttpError(401, "Not signed in");
  return req.creator;
}
