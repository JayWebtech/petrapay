import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { env } from "./env.ts";
import { HttpError } from "./lib/http.ts";
import { addressRoutes } from "./routes/addresses.ts";
import { authRoutes } from "./routes/auth.ts";
import { developerRoutes } from "./routes/developers.ts";
import { invoiceRoutes } from "./routes/invoices.ts";
import { linkRoutes, publicLinkRoutes } from "./routes/links.ts";
import { publicRoutes } from "./routes/public.ts";
import { v1Routes } from "./routes/v1.ts";
import { withdrawalRoutes } from "./routes/withdrawals.ts";

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({
    logger: opts.logger === false ? false : {
      level: process.env.LOG_LEVEL ?? "info",
      transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
      // Never log cookies or bodies: they can hold session tokens and payer addresses.
      redact: ["req.headers.cookie", "req.headers.authorization"],
    },
    trustProxy: true,
  });

  // BigInt shows up in Prisma rows; make sure it can never crash serialization.
  app.setReplySerializer((payload) => JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));

  await app.register(cookie);
  await app.register(cors, { origin: env.APP_ORIGIN, credentials: true });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      return reply.status(err.status).send({ error: err.message, details: err.details });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.status(status).send({ error: (err as Error).message });
    }
    req.log.error({ err }, "unhandled error");
    return reply.status(500).send({ error: "Something went wrong" });
  });

  app.get("/health", async () => ({ ok: true }));

  await app.register(authRoutes);
  await app.register(publicRoutes);
  await app.register(publicLinkRoutes);
  await app.register(addressRoutes);
  await app.register(invoiceRoutes);
  await app.register(linkRoutes);
  await app.register(withdrawalRoutes);
  await app.register(developerRoutes);
  // Public merchant API (secret-key auth, Stripe-style errors).
  await app.register(v1Routes, { prefix: "/v1" });

  return app;
}
