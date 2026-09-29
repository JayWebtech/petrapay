import { buildApp } from "./app.ts";
import { prisma } from "./db.ts";
import { env } from "./env.ts";
import { getTokens } from "./services/oneclick.ts";
import { startWorker } from "./worker.ts";

const app = await buildApp();

// Warm the token cache so the first checkout doesn't wait on it.
getTokens().catch((err) => app.log.warn({ err }, "initial token fetch failed"));

const stopWorker = env.WORKER_ENABLED ? startWorker(app.log) : () => {};

const shutdown = async () => {
  stopWorker();
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
