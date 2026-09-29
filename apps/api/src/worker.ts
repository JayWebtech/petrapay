import type { FastifyBaseLogger } from "fastify";
import { prisma } from "./db.ts";
import { env } from "./env.ts";
import { refreshSwap } from "./services/swaps.ts";

const BATCH = 25;
/**
 * Unpaid deposit addresses past their pay-by deadline, and swaps stuck for hours (e.g. slow refunds),
 * are checked less often until 1Click reports a final status or the address goes inactive.
 */
const SLOW_LANE_AFTER_MS = 6 * 60 * 60_000;
const SLOW_LANE_INTERVAL_MS = 10 * 60_000;

/**
 * Mirrors 1Click swap status into Postgres so invoices flip to PAID even when nobody has the page open.
 * Safe to run on several instances: each tick claims rows by bumping lastCheckedAt first.
 */
export function startWorker(log: FastifyBaseLogger) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const due = await prisma.swap.findMany({
        where: {
          status: { in: ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "INCOMPLETE_DEPOSIT"] },
          OR: [
            { lastCheckedAt: null },
            // Fast lane: awaiting a deposit before the pay-by deadline…
            { lastCheckedAt: { lt: new Date(now - env.POLL_INTERVAL_MS) }, status: "PENDING_DEPOSIT", deadline: { gt: new Date(now) } },
            // …or a deposit is in flight.
            {
              lastCheckedAt: { lt: new Date(now - env.POLL_INTERVAL_MS) },
              status: { not: "PENDING_DEPOSIT" },
              deadline: { gt: new Date(now - SLOW_LANE_AFTER_MS) },
            },
            { lastCheckedAt: { lt: new Date(now - SLOW_LANE_INTERVAL_MS) } },
          ],
        },
        orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
        take: BATCH,
      });

      for (const swap of due) {
        const claimed = await prisma.swap.updateMany({
          where: { id: swap.id, lastCheckedAt: swap.lastCheckedAt },
          data: { lastCheckedAt: new Date() },
        });
        if (claimed.count === 0) continue;
        try {
          const updated = await refreshSwap(swap);
          if (updated.status !== swap.status) {
            log.info({ swap: swap.id, kind: swap.kind, from: swap.status, to: updated.status }, "swap status changed");
          }
        } catch (err) {
          log.warn({ err, swap: swap.id }, "swap refresh failed");
        }
      }
    } catch (err) {
      log.error({ err }, "worker tick failed");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, Math.max(2000, Math.floor(env.POLL_INTERVAL_MS / 2)));
  void tick();
  return () => clearInterval(timer);
}
