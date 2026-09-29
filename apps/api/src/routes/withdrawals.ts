import {
  ZEC_ASSET_ID,
  checkZecRefundAddress,
  formatZats,
  fromBaseUnits,
  quoteDeadline,
  toBaseUnits,
  withdrawQuoteSchema,
  type QuotePreviewDTO,
  type StatsDTO,
} from "@petrapay/shared";
import type { FastifyInstance } from "fastify";
import { prisma } from "../db.ts";
import { HttpError, notFound, parseBody } from "../lib/http.ts";
import { creatorOf, requireCreator } from "../services/auth.ts";
import { QuoteRequest, getToken, requestQuote, requireToken } from "../services/oneclick.ts";
import { createSwap, isTerminal, refreshSwap, toSwapDTO } from "../services/swaps.ts";

export async function withdrawalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireCreator);

  /**
   * Swap ZEC out to any supported chain. The creator sends ZEC from their own shielded wallet to the
   * quote's deposit address; PetraPay never touches the funds.
   */
  app.post("/withdrawals/quote", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req) => {
    const creator = creatorOf(req);
    const body = parseBody(withdrawQuoteSchema, req);
    const destination = await requireToken(body.destinationAsset);
    if (destination.assetId === ZEC_ASSET_ID) throw new HttpError(400, "Pick a token other than native ZEC");

    const refund = checkZecRefundAddress(body.refundTo);
    if (!refund.ok) throw new HttpError(400, `Refund address: ${refund.error}`);

    const zats = toBaseUnits(body.amountZec, 8);
    const response = await requestQuote({
      dry: body.dry,
      swapType: QuoteRequest.swapType.EXACT_INPUT,
      originAsset: ZEC_ASSET_ID,
      destinationAsset: destination.assetId,
      amount: zats,
      recipient: body.recipient,
      refundTo: body.refundTo,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN,
      deadline: quoteDeadline("zec"),
    }).catch((err: unknown) => {
      const min = err instanceof HttpError ? (err.details as { minBaseUnits?: string } | undefined)?.minBaseUnits : undefined;
      if (min) throw new HttpError(400, `Minimum withdrawal for this route is ${fromBaseUnits(min, 8)} ZEC.`);
      throw err;
    });

    if (body.dry) {
      const q = response.quote;
      const preview: QuotePreviewDTO = {
        amountIn: q.amountIn,
        amountInFormatted: q.amountInFormatted,
        amountInUsd: q.amountInUsd,
        minAmountIn: q.minAmountIn,
        amountOut: q.amountOut,
        amountOutFormatted: q.amountOutFormatted,
        amountOutUsd: q.amountOutUsd,
        timeEstimate: q.timeEstimate,
        confidentiality: response.quoteRequest.confidentiality ?? "public",
      };
      return preview;
    }

    const swap = await createSwap({ kind: "WITHDRAWAL", creatorId: creator.id, swapType: "EXACT_INPUT", response });
    return toSwapDTO(swap);
  });

  app.get("/withdrawals", async (req) => {
    const swaps = await prisma.swap.findMany({
      where: { creatorId: creatorOf(req).id, kind: "WITHDRAWAL" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Promise.all(swaps.map(toSwapDTO));
  });

  app.get<{ Params: { id: string } }>("/withdrawals/:id", async (req) => {
    let swap = await prisma.swap.findFirst({ where: { id: req.params.id, creatorId: creatorOf(req).id, kind: "WITHDRAWAL" } });
    if (!swap) throw notFound("Withdrawal not found");
    if (!isTerminal(swap.status)) swap = await refreshSwap(swap);
    return toSwapDTO(swap);
  });

  app.get<{ Querystring: { days?: string } }>("/stats", async (req): Promise<StatsDTO> => {
    const creatorId = creatorOf(req).id;
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
    const [paid, open, withdrawals, settledPayments, zec] = await Promise.all([
      prisma.invoice.findMany({
        where: { creatorId, status: "PAID" },
        select: { receivedZats: true, receivedUsd: true, paidAt: true },
      }),
      prisma.invoice.findMany({
        // Link checkouts that were started but never paid are abandoned carts, not money owed.
        where: { creatorId, status: { in: ["OPEN", "PROCESSING"] }, OR: [{ linkId: null }, { status: "PROCESSING" }] },
        select: { status: true, currency: true, amount: true },
      }),
      prisma.swap.findMany({ where: { creatorId, kind: "WITHDRAWAL", status: "SUCCESS" }, select: { amountIn: true } }),
      prisma.swap.findMany({
        where: { creatorId, kind: "INVOICE_PAYMENT", status: "SUCCESS" },
        select: { originAsset: true, amountInUsd: true, amountOutUsd: true },
      }),
      getToken(ZEC_ASSET_ID),
    ]);

    const zecPrice = zec?.priceUsd ?? null;
    const receivedZats = paid.reduce((sum, i) => sum + (i.receivedZats ?? 0n), 0n);
    const receivedUsd = paid.reduce((sum, i) => sum + Number(i.receivedUsd ?? 0), 0);
    const openAmountUsd = open.reduce((sum, i) => {
      const n = Number(i.amount);
      return sum + (i.currency === "USD" ? n : n * (zecPrice ?? 0));
    }, 0);

    // Daily buckets over the requested range, oldest first.
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const buckets = new Map<string, { zats: bigint; usd: number; count: number }>();
    for (let d = 0; d < days; d++) {
      const date = new Date(start.getTime() + d * 86_400_000).toISOString().slice(0, 10);
      buckets.set(date, { zats: 0n, usd: 0, count: 0 });
    }
    for (const i of paid) {
      if (!i.paidAt) continue;
      const bucket = buckets.get(i.paidAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      bucket.zats += i.receivedZats ?? 0n;
      bucket.usd += Number(i.receivedUsd ?? 0);
      bucket.count += 1;
    }

    // Which tokens clients actually paid with, by settled USD value.
    const byAsset = new Map<string, { count: number; usd: number }>();
    for (const s of settledPayments) {
      const entry = byAsset.get(s.originAsset) ?? { count: 0, usd: 0 };
      entry.count += 1;
      entry.usd += Number(s.amountOutUsd ?? s.amountInUsd ?? 0);
      byAsset.set(s.originAsset, entry);
    }
    const paidWith = await Promise.all(
      [...byAsset.entries()]
        .sort((a, b) => b[1].usd - a[1].usd)
        .slice(0, 5)
        .map(async ([assetId, v]) => {
          const t = await getToken(assetId);
          return { symbol: t?.symbol ?? "?", chain: t?.blockchain ?? "unknown", count: v.count, usd: v.usd.toFixed(2) };
        }),
    );

    return {
      receivedZec: formatZats(receivedZats),
      receivedUsdAtSettlement: receivedUsd.toFixed(2),
      paidCount: paid.length,
      openCount: open.filter((i) => i.status === "OPEN").length,
      processingCount: open.filter((i) => i.status === "PROCESSING").length,
      openAmountUsd: openAmountUsd.toFixed(2),
      withdrawnZec: formatZats(withdrawals.reduce((sum, w) => sum + BigInt(w.amountIn), 0n)),
      zecPriceUsd: zecPrice,
      series: [...buckets.entries()].map(([date, b]) => ({ date, zec: formatZats(b.zats), usd: b.usd.toFixed(2), count: b.count })),
      paidWith,
    };
  });
}
