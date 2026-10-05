import type { FastifyBaseLogger } from "fastify";
import { prisma } from "./db.ts";
import { env } from "./env.ts";
import { refreshSwap } from "./services/swaps.ts";
import { deliverDueWebhooks, emitCheckoutEvent } from "./services/webhooks.ts";

const WEBHOOK_TICK_MS = 3_000;

/**
 * Open checkouts past their expiry become EXPIRED, unless a customer still holds a live quote
 * (they could pay any moment; the sweep waits for that quote to lapse).
 */
export async function expireCheckouts(log: Pick<FastifyBaseLogger, "info">) {
  const now = new Date();
  const due = await prisma.invoice.findMany({
    where: { status: "OPEN", expiresAt: { lte: now }, swaps: { none: { status: "PENDING_DEPOSIT", deadline: { gt: now } } } },
    select: { id: true },
    take: 50,
  });
  for (const { id } of due) {
    const res = await prisma.invoice.updateMany({ where: { id, status: "OPEN" }, data: { status: "EXPIRED" } });
    if (res.count === 1) {
      log.info({ invoice: id }, "checkout expired");
      await emitCheckoutEvent(id, "checkout.expired");
    }
  }
}

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

  // Merchant-facing work runs on its own loop so a slow webhook endpoint never delays payment status.
  let housekeeping = false;
  const merchantTick = async () => {
    if (housekeeping) return;
    housekeeping = true;
    try {
      await expireCheckouts(log);
      await deliverDueWebhooks();
    } catch (err) {
      log.error({ err }, "webhook/expiry tick failed");
    } finally {
      housekeeping = false;
    }
  };

  const timer = setInterval(tick, Math.max(2000, Math.floor(env.POLL_INTERVAL_MS / 2)));
  const merchantTimer = setInterval(merchantTick, WEBHOOK_TICK_MS);
  void tick();
  void merchantTick();
  return () => {
    clearInterval(timer);
    clearInterval(merchantTimer);
  };
}
